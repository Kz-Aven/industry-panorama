import { writeFileSync } from 'node:fs';
import { loadWorkspace, root } from '../src/workspace.mjs';
import { escape } from '../src/svg.mjs';

const workspace=loadWorkspace();
const registry=[...workspace.assets.values()];
const groups=new Map();
for (const asset of registry) {
  const key=asset.industry==='universal'?'通用资产':(workspace.packs.get(asset.industry)?.name ?? asset.industry)+'资产';
  if (!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(asset);
}
const content=[...groups].map(([title,assets])=>`<section><h2>${title} <small>${assets.length}</small></h2><div class="grid">${assets.map(asset=>`
  <article>
    <div class="sprite">${asset.supported_directions.map((angle,i)=>{
      const source='../'+escape(asset.variants[angle].file);
      return `<a data-angle="${angle}" href="${source}"${i?' hidden':''}><img loading="lazy" src="${source}" alt="${escape(asset.name)} ${angle}°"></a>`;
    }).join('')}</div>
    <h3>${escape(asset.name)}</h3><p>${escape(asset.id)}</p>
    <small>${asset.source_type==='imagegen'?'写实 PNG':'程序化 SVG'} · ${asset.footprint.join(' × ')} × ${Number(asset.height.toFixed(2))} m</small>
  </article>`).join('')}</div></section>`).join('');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>等距资产库</title><style>
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;font-family:system-ui,sans-serif;color:#203b49;background:#f5f7f6}
header{background:#203b49;color:#f7fbfa;padding:25px max(calc((100vw - 1250px)/2),20px)}
h1{margin:0 0 8px}header p{margin:0;color:#dbe8e7}
main{max-width:1290px;margin:auto;padding:20px}
label{display:flex;align-items:center;gap:8px;font-size:14px}select{font:inherit;padding:5px;color:inherit}
h2{font-size:20px}h2 small{font-weight:normal;color:#536a73}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(176px,1fr));gap:12px}
article{min-width:0;padding:10px;background:white;border:1px solid #d1dedc;border-radius:8px}
.sprite{display:grid;place-items:center;height:142px;background:#eef3f1;border-radius:5px}
.sprite a{display:grid;place-items:center;width:100%;height:100%}.sprite img{display:block;max-width:90%;max-height:128px}
h3{margin:8px 0 4px;font-size:15px}article p{font-size:11px;overflow-wrap:anywhere;margin:4px 0;color:#536a73}article small{font-size:11px;color:#536a73}
</style></head><body><header><h1>等距资产库</h1><p>${registry.filter(a=>a.source_type==='imagegen').length} / ${registry.length} 件写实独立素材</p></header>
<main><label>查看朝向<select id="angle"><option>0°</option><option>90°</option><option>180°</option><option>270°</option></select></label>
${content}</main><script>
document.getElementById('angle').addEventListener('change',event=>{
  for(const sprite of document.querySelectorAll('.sprite')){
    const links=[...sprite.querySelectorAll('a')];
    const picked=links.find(link=>link.dataset.angle+'°'===event.target.value) ?? links[0];
    for(const link of links) link.hidden=link!==picked;
  }
});
</script></body></html>`;
writeFileSync(new URL('outputs/asset-library.html',root),html);
console.log('outputs/asset-library.html');
