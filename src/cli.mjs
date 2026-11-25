#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { auditAssets, loadWorkspace, missingAssets, searchAssets, validateSchema } from './workspace.mjs';
import { validateDocument } from './knowledge.mjs';
import { compose } from './composer.mjs';
import { loadIllustration, renderAtlasSVG, renderScene } from './svg.mjs';
import { renderHTML } from './html.mjs';
import { matchAction } from './action-match.mjs';
import { rasterizeSVG } from './png.mjs';
import { buildFossflow, fossflowMappingPath } from './fossflow.mjs';

function write(path, text) {
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,text);
}

const readJSONFile=path=>JSON.parse(readFileSync(path,'utf8'));
const saveJSON=(path,value)=>write(path,JSON.stringify(value,null,2)+'\n');
const formats=['svg','png','html','plan','fossflow'];
const suffix=format=>({plan:'.plan.json',fossflow:'.fossflow.json'})[format] ?? '.'+format;

function renderDocument(document,kind,workspace,values,output,{assetsChecked=false}={}) {
  const format=values.format ?? (kind==='scene'?'svg':'html');
  if (!formats.includes(format)) throw new Error(`不支持输出格式：${format}`);
  if(format==='fossflow' && kind!=='atlas') throw new Error('FossFLOW 导出需要 Atlas JSON');
  const scenes=document.scenes ?? [document];
  const plans=[], illustrations=[], failures=[];
  for(const scene of scenes) {
    const missing=assetsChecked?[]:missingAssets(scene,workspace).missing;
    if(missing.length) {
      failures.push({scene_id:scene.id,kind:'missing-assets',missing});
      continue;
    }
    try {
      plans.push(compose(scene,workspace));
      illustrations.push(scene.render.illustration && loadIllustration(scene.render.illustration));
    } catch(error) {
      failures.push({scene_id:scene.id,kind:'invalid-scene',message:error.message});
    }
  }
  if(failures.length) return {status:'failed',failures};
  if(!output) return {status:'ok',scenes:scenes.length};
  if(format==='fossflow') {
    const {diagram,mapping}=buildFossflow(document,plans,illustrations,workspace);
    const mappingPath=fossflowMappingPath(output);
    saveJSON(output,diagram);
    saveJSON(mappingPath,mapping);
    return {status:'ok',scenes:scenes.length,output,mapping: mappingPath};
  }
  if (format==='plan') {
    saveJSON(output,kind==='scene'?plans[0]:plans);
  } else {
    const images=new Map(scenes.map((scene,i)=>[scene.id,renderScene(scene,plans[i],workspace,kind==='atlas'||format==='html'?false:undefined,illustrations[i])]));
    if(format==='html') write(output,renderHTML(document,images));
    else {
      const svg=kind==='atlas'?renderAtlasSVG(document,images):images.get(document.id);
      if(format==='svg') write(output,svg+'\n');
      else {
        write(output,rasterizeSVG(svg,{width:values.width ?? (values.height?undefined:workspace.rendering.png_width),height:values.height}));
      }
    }
  }
  return {status:'ok',scenes:scenes.length,output};
}

function batch(manifestPath,workspace,values) {
  const manifest=readJSONFile(manifestPath);
  validateSchema('batch',manifest);
  const outputDir=resolve(values.out ?? 'outputs/batch');
  const report=join(outputDir,'batch-report.json');
  const paths=new Set([resolve(manifestPath),...manifest.jobs.map(job=>resolve(dirname(manifestPath),job.input))]);
  if(paths.has(report)) throw new Error('批次报告路径与输入路径相同');
  paths.add(report);
  const results=manifest.jobs.map(job=>{
    const input=resolve(dirname(manifestPath),job.input);
    try {
      const document=readJSONFile(input);
      const kind=validateDocument(document);
      const format=job.format ?? values.format ?? 'html';
      const output=join(outputDir,job.output ?? document.id+suffix(format));
      const destinations=format==='fossflow'?[output,fossflowMappingPath(output)]:[output];
      for(const path of destinations) if(paths.has(path)) throw new Error(`任务输出路径重复或覆盖输入：${path}`);
      for(const path of destinations) paths.add(path);
      return {input,...renderDocument(document,kind,workspace,{...values,format},output)};
    } catch(error) {
      return {input,status:'failed',message:error.message};
    }
  });
  const ok=results.filter(job=>job.status==='ok').length;
  saveJSON(report,{ok,failed:results.length-ok,jobs:results});
  console.log(`${report} · ${ok} 成功 / ${results.length-ok} 失败`);
  return ok===results.length?0:1;
}

function main() {
  const {positionals,values} = parseArgs({
    allowPositionals:true,
    options:{ format:{type:'string'}, out:{type:'string',short:'o'}, width:{type:'string'}, height:{type:'string'},
      industry:{type:'string'}, help:{type:'boolean',short:'h'} },
  });
  const [command,arg,value] = positionals;
  if (!command || values.help) {
    console.log(`isometric-scene-composer
  scene validate <scene|atlas.json>
  scene assets search <query> [--industry <id>]
  scene assets match <action.json>
  scene batch <manifest.json> [-o directory]
  scene assets check <scene|atlas.json> [-o missing-assets.json]
  scene assets audit
  scene render <scene.json> [--format svg|png|html|plan] [-o path]
  scene atlas <atlas.json> [--format html|svg|png|plan|fossflow] [-o path]
  scene export <atlas.json> [--format fossflow] [-o path]
  PNG: [--width px] [--height px]，依赖 rsvg-convert`);
    return 0;
  }
  const workspace = loadWorkspace();
  if(command==='batch' && arg) return batch(arg,workspace,values);
  if(command==='assets' && arg==='match' && value){
    const result=matchAction(workspace,readJSONFile(value));
    console.log(JSON.stringify(result,null,2));
    return result.status==='matched'?0:2;
  }
  if (command==='assets' && arg==='audit') {
    console.log(JSON.stringify(auditAssets(workspace),null,2));
    return 0;
  }
  if (command==='assets' && arg==='search' && value?.trim()) {
    console.log(JSON.stringify(searchAssets(workspace,value,values.industry).map(({id,name,category,industry,footprint,height,aliases})=>({
      id,name,category,industry,footprint,height,aliases,
    })),null,2));
    return 0;
  }
  const check = command==='assets' && arg==='check';
  if (!check && !['validate','render','atlas','export'].includes(command)) throw new Error('未识别的命令，使用 --help。');
  const input = check ? value : arg;
  if (!input) throw new Error('缺少场景或图谱 JSON 路径');
  const document = JSON.parse(readFileSync(input,'utf8'));
  const kind = validateDocument(document);
  if (['atlas','export'].includes(command) && kind!=='atlas' || command==='render' && kind!=='scene') {
    throw new Error(`输入是 ${kind}，请使用 ${kind==='scene'?'render':'atlas'}`);
  }
  if(command==='export' && values.format && values.format!=='fossflow') throw new Error('export 仅支持 fossflow 格式');
  const format = values.format ?? (command==='export'?'fossflow':kind==='scene'?'svg':'html');
  if (!formats.includes(format)) throw new Error(`不支持输出格式：${format}`);
  const output = resolve(values.out ?? join('outputs',document.id+suffix(format)));
  const missing = missingAssets(document,workspace);
  if (check || missing.missing.length) {
    const report = check && values.out ? output : join(check ? resolve('outputs') : dirname(output),'missing-assets.json');
    if (resolve(input)===report) throw new Error('缺失报告路径与输入路径相同');
    write(report,JSON.stringify(missing,null,2)+'\n');
    console.log(`${report} · ${missing.missing.length} 个缺失素材`);
    return missing.missing.length ? 2 : 0;
  }
  if(command!=='validate' && [output,...(format==='fossflow'?[fossflowMappingPath(output)]:[])].includes(resolve(input))) {
    throw new Error('输出路径与输入路径相同');
  }
  const result=renderDocument(document,kind,workspace,{...values,format},command==='validate'?null:output,{assetsChecked:true});
  if(result.status==='failed') throw new Error(result.failures.map(f=>`${f.scene_id}：${f.message ?? f.kind}`).join('\n'));
  console.log(command==='validate'?`通过 · ${kind} · ${result.scenes} 个场景`:output);
  if(result.mapping) console.log(result.mapping);
  return 0;
}

try {
  process.exitCode=main();
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
}
