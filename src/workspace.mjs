import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import Ajv from 'ajv';
import { parse } from 'yaml';

export const root = new URL('../', import.meta.url);
export const read = path => readFileSync(new URL(path, root), 'utf8');
export const readJSON = path => JSON.parse(read(path));

const ajv = new Ajv({ allErrors: true, strictRequired: false });
for (const file of readdirSync(new URL('schemas/', root))) ajv.addSchema(readJSON('schemas/'+file));

export function validateSchema(kind, value) {
  const verify = ajv.getSchema(kind+'.schema.json');
  if (!verify(value)) {
    throw new Error(verify.errors.map(e => `${kind}${e.instancePath} ${e.message}${e.params.additionalProperty ? ' ('+e.params.additionalProperty+')' : ''}`).join('\n'));
  }
}

export function byId(items, name) {
  const map = new Map();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`${name} ID 重复：${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

export function loadWorkspace() {
  const style = parse(read('config/visual-style.yaml'));
  const rendering = parse(read('config/rendering.yaml'));
  const policy = parse(read('config/asset-policy.yaml'));
  const registry = readJSON('assets/registry.json');
  const external = new URL('assets/imported/',root);
  if (existsSync(external)) {
    for (const dir of readdirSync(external,{withFileTypes:true})) {
      if (dir.isDirectory()) registry.push(readJSON(`assets/imported/${dir.name}/asset.json`));
    }
  }
  validateSchema('asset', registry);
  const assets = byId(registry, '素材');
  const templates = byId(readdirSync(new URL('templates/', root)).filter(f=>f.endsWith('.json')).map(file => {
    const template = readJSON('templates/'+file);
    validateSchema('template', template);
    return template;
  }), '模板');
  const packs = byId(readdirSync(new URL('industry-packs/', root), {withFileTypes:true}).filter(f=>f.isDirectory()).map(dir => {
    const pack = parse(read(`industry-packs/${dir.name}/manifest.yaml`));
    validateSchema('industry-pack', pack);
    for (const id of Object.values(pack.asset_mappings).flat()) {
      if (!assets.has(id)) throw new Error(`${pack.id} 引用了无效素材：${id}`);
    }
    for (const id of pack.templates) {
      if (!templates.has(id)) throw new Error(`${pack.id} 引用了无效模板：${id}`);
    }
    return pack;
  }), '行业包');
  return { style, rendering, policy, assets, templates, packs, local: new LocalAssetProvider() };
}

class LocalAssetProvider {
  #cache = new Map();

  load(asset, rotation) {
    const variant = asset.variants[rotation];
    if (!variant || !asset.supported_directions.includes(rotation)) {
      throw new Error(`${asset.id} 不支持 ${rotation}°`);
    }
    if (!variant.file.startsWith('assets/') || variant.file.split('/').includes('..')) {
      throw new Error(`素材路径必须在 assets/ 内：${variant.file}`);
    }
    if (!this.#cache.has(variant.file)) {
      const data=readFileSync(new URL(variant.file,root));
      if (createHash('sha256').update(data).digest('hex') !== variant.sha256) {
        throw new Error(`素材哈希不匹配：${variant.file}`);
      }
      const isPNG=variant.file.endsWith('.png');
      if (isPNG) {
        if (data.length<33 || data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' ||
            data.toString('ascii',12,16)!=='IHDR' || data[25]!==6 || !data.readUInt32BE(16) || !data.readUInt32BE(20)) {
          throw new Error(`素材必须是 RGBA PNG：${variant.file}`);
        }
      } else {
        const svg=data.toString('utf8').trim();
        if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) throw new Error(`素材 SVG 无效：${variant.file}`);
      }
      this.#cache.set(variant.file,{ mime:isPNG?'image/png':'image/svg+xml',data });
    }
    return this.#cache.get(variant.file);
  }
}

export function auditAssets(workspace) {
  const hashes = new Map();
  for (const asset of workspace.assets.values()) {
    if (asset.source_type === 'external' && !asset.source_url) throw new Error(`外部素材缺少来源：${asset.id}`);
    const first = asset.variants[asset.supported_directions[0]];
    if (!first || asset.file !== first.file || asset.anchor.some((value,i)=>value !== first.anchor[i])) {
      throw new Error(`素材默认文件或锚点不一致：${asset.id}`);
    }
    for (const direction of asset.supported_directions) {
      const media = workspace.local.load(asset, direction);
      const { sha256, view_box, file, anchor } = asset.variants[direction];
      if (view_box[2]<=0 || view_box[3]<=0 || anchor[0]!==-view_box[0] || anchor[1]!==-view_box[1]) {
        throw new Error(`素材视窗或锚点不一致：${file}`);
      }
      if (media.mime==='image/svg+xml' && !media.data.includes(`viewBox="${view_box.join(' ')}"`)) {
        throw new Error(`素材 viewBox 不匹配：${file}`);
      }
      if (hashes.has(sha256) && hashes.get(sha256) !== asset.id) {
        throw new Error(`素材内容重复：${asset.id} / ${hashes.get(sha256)}`);
      }
      hashes.set(sha256, asset.id);
    }
  }
  return { assets:workspace.assets.size, variants:[...workspace.assets.values()].reduce((sum,a)=>sum+a.supported_directions.length,0) };
}

export function searchAssets(workspace, query, industry) {
  const term = query.trim().toLowerCase();
  const packIds = workspace.packs.get(industry)?.asset_mappings[query] ?? [];
  return [...workspace.assets.values()]
    .filter(a=>a.status === workspace.policy.active_status && a.style_profile === workspace.style.id &&
      (!industry || a.industry === industry || a.industry === 'universal' || a.id === term))
    .map(a=>{
      const tags = a.tags.map(t=>t.toLowerCase());
      const aliases = a.aliases.map(t=>t.toLowerCase());
      const score = a.id === term ? 10 : packIds.includes(a.id) ? 8 :
        a.name.toLowerCase() === term ? 7 : tags.includes(term) ? 6 : aliases.includes(term) ? 5 :
        [...tags, ...aliases,a.id].some(t=>t.includes(term)) ? 2 : 0;
      return { asset:a, score:score && score+(a.industry === industry ? .5 : 0) };
    })
    .filter(result=>result.score)
    .sort((a,b)=>b.score-a.score || a.asset.id.localeCompare(b.asset.id))
    .map(result=>result.asset);
}

export function missingAssets(document, workspace) {
  const missing = new Map();
  const paths = new Map();
  for (const scene of document.scenes ?? [document]) {
    const { objects, platform } = scene.scene;
    for (const object of [{ id:'platform', ...platform }, ...objects]) {
      const asset = workspace.assets.get(object.asset_id);
      const file=asset?.variants[object.rotation ?? 0]?.file;
      if (file && !paths.has(file)) paths.set(file,existsSync(new URL(file,root)));
      const reason = !asset ? 'unregistered' : asset.status !== workspace.policy.active_status ? 'draft' :
        asset.style_profile !== (scene.render.style_profile ?? workspace.style.id) ? 'style_mismatch' :
        !asset.supported_directions.includes(object.rotation ?? 0) ? 'unsupported_direction' :
        !paths.get(file) ? 'file_missing' : null;
      if (!reason) continue;
      const key = `${object.asset_id}:${reason}`;
      if (!missing.has(key)) {
        const name = object.label ?? asset?.name ?? object.asset_id;
        missing.set(key, {
          asset_id:object.asset_id, name, reason, industry:scene.industry, uses:[],
          prompt:`绘制「${name}」作为「${scene.title}」中的独立素材。业务用途：${scene.description}。物体结构按名称与使用动作表现，保持真实构件与功能。正交等距，水平轴各 30°，左上柔光，哑光深蓝、工业蓝、青绿与浅灰蓝，沿用统一人物和设备比例。真实人体或工业构造、哑光微纹理、支撑接触轮廓完整，保留真透明背景。以 0°、90°、180°、270° 排成四格，每格只画一件，无文字、无场景底座和额外物品。`,
        });
      }
      missing.get(key).uses.push({ scene_id:scene.id, object_id:object.id, rotation:object.rotation ?? 0 });
    }
  }
  return { schema_version:'1.0.0', missing:[...missing.values()] };
}
