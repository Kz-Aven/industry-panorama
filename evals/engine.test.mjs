import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { auditAssets, loadWorkspace, readJSON, root, searchAssets } from '../src/workspace.mjs';
import { validateDocument } from '../src/knowledge.mjs';
import { compose } from '../src/composer.mjs';

const workspace=loadWorkspace();
const hero=readJSON('examples/manufacturing-atlas/production-quality.json');
const atlas=readJSON('examples/manufacturing-atlas/atlas.json');
const pmc=readJSON('examples/pmc-role/atlas.json');
const finance=readJSON('examples/finance-review/scene.json');
const shipment=readJSON('evals/cases/shipment.json');
const source=readJSON('examples/manufacturing-atlas/source-data.json');
const input='examples/manufacturing-atlas/production-quality.json';
const cwd=fileURLToPath(root);
const cli=(...args)=>spawnSync(process.execPath,['src/cli.mjs',...args],{cwd,encoding:'utf8'});
const temporary=t=>{
  const path=mkdtempSync(join(tmpdir(),'scene-eval-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));
  return path;
};
function object(scene,id) {
  return scene.scene.objects.find(o=>o.id===id);
}

test('registry integrity, indexed asset lookup and manufacturing pack',()=>{
  assert.deepEqual(auditAssets(workspace),{assets:57,variants:228});
  assert.equal([...workspace.assets.values()].filter(a=>a.industry==='universal').length,31);
  assert.equal(workspace.packs.get('manufacturing').templates.length,6);
  assert.equal(searchAssets(workspace,'数控机床','manufacturing')[0].id,'manufacturing.equipment.cnc');
  assert.equal(searchAssets(workspace,'排产','manufacturing')[0].id,'universal.accessory.kanban');
  assert.equal(searchAssets(workspace,'CNC')[0].id,'manufacturing.equipment.cnc');
  assert.equal(searchAssets(workspace,'发货单')[0].id,'universal.document.order');
  assert.equal(searchAssets(workspace,'仓管员')[0].id,'universal.person.worker');
});

test('all benchmark scenes validate, reuse the same registry and fit their layout',()=>{
  for(const document of [hero,atlas,pmc,finance,shipment]){
    validateDocument(document);
    for(const scene of document.scenes ?? [document]) {
      const plan=compose(scene,workspace);
      const [x,y,w,h]=plan.bounds;
      for(const item of plan.objects){
        const [a,b,c,d]=item.rect;
        assert.ok(a>=x&&b>=y&&a+c<=x+w&&b+d<=y+h,item.id);
      }
    }
  }
  assert.ok(finance.scene.objects.every(o=>o.asset_id.startsWith('universal.')));
  const pmcAssets=new Set(pmc.scenes[0].scene.objects.map(o=>o.asset_id));
  assert.ok(finance.scene.objects.filter(o=>pmcAssets.has(o.asset_id)).length>=5);
});

test('original dataset content, relationships, ordering and stable IDs are retained',()=>{
  assert.deepEqual(atlas.scenes.map(s=>s.title),source.groups.map(g=>g.name));
  assert.deepEqual(atlas.zones.map(z=>z.title),source.zones);
  assert.deepEqual(atlas.layers,source.layers);
  assert.deepEqual(atlas.layers.map(l=>l.sections.map(s=>s.entries.length)),[[7],[5],[3,3,3]]);
  const all=atlas.scenes.flatMap((s,i)=>{
    assert.deepEqual(s.semantic.cases.map(c=>c.id),source.groups[i].cases.map(n=>'case-'+n));
    return s.semantic.cases;
  });
  assert.equal(new Set(all.map(c=>c.id)).size,Object.keys(source.entries).length);
  for(const c of all) {
    const original=source.entries[c.id.slice(5)];
    assert.deepEqual([c.title,c.roles,c.description],[original.title,original.roles,original.pain]);
    assert.deepEqual(c.source_refs,['source-'+c.id]);
  }
  assert.equal(hero.semantic.cases.length,10);
  assert.deepEqual(atlas.scenes.find(s=>s.id===hero.id),hero);
});

test('template slots, support elevation and rendering order',()=>{
  const plan=compose(hero,workspace);
  const machine=plan.objects.find(o=>o.id==='machine');
  assert.deepEqual(machine.position,[3.1,2.85,0]);
  const sample=plan.objects.find(o=>o.id==='sample');
  assert.equal(sample.position[2],1.13);
  assert.ok(plan.objects.findIndex(o=>o.id==='inspection')<plan.objects.indexOf(sample));
  assert.ok(plan.objects.findIndex(o=>o.id==='machine')<plan.objects.findIndex(o=>o.id==='operator'));
});

test('malformed schemas, stale references and Emoji labels fail',()=>{
  const scene=structuredClone(hero);
  scene.scene.objects[0].rotation=31;
  assert.throws(()=>validateDocument(scene),/rotation/);
  scene.scene.objects[0].rotation=0;
  scene.scene.objects[0].label='🔧';
  assert.throws(()=>validateDocument(scene),/Emoji/);
  delete scene.scene.objects[0].label;
  scene.semantic.cases[0].source_refs=['gone'];
  assert.throws(()=>validateDocument(scene),/gone/);
  const map=structuredClone(atlas);
  map.connections[0].target='gone';
  assert.throws(()=>validateDocument(map),/gone/);
  assert.throws(()=>validateDocument(null),/object/);
});

test('collision, out of bounds, unsupported elevation and support loop fail',()=>{
  const scene=structuredClone(hero);
  const op=object(scene,'operator');
  op.position=[3.1,2.85,0];
  assert.throws(()=>compose(scene,workspace),/重叠/);
  op.position=[-1,2,0];
  assert.throws(()=>compose(scene,workspace),/超出底板/);
  op.position=[3,5,2];
  assert.throws(()=>compose(scene,workspace),/support/);
  op.position=object(hero,'operator').position;
  object(scene,'inspection').support='sample';
  assert.throws(()=>compose(scene,workspace),/成环/);
});

test('unknown industry renders with approved universal assets and reports unresolved domain assets',t=>{
  const path=temporary(t);
  const scene=structuredClone(finance);
  scene.industry='new-industry';
  const file=join(path,'input.json'), output=join(path,'scene.svg');
  writeFileSync(file,JSON.stringify(scene));
  assert.equal(cli('validate',file).status,0);
  scene.scene.objects[0].asset_id='new-industry.equipment.sealer';
  scene.scene.objects[0].label='封装机';
  writeFileSync(file,JSON.stringify(scene));
  const run=cli('render',file,'--out',output);
  assert.equal(run.status,2,run.stderr);
  assert.ok(!existsSync(output));
  const missing=JSON.parse(readFileSync(join(path,'missing-assets.json'),'utf8')).missing[0];
  assert.equal(missing.asset_id,'new-industry.equipment.sealer');
  assert.equal(missing.reason,'unregistered');
  assert.match(missing.prompt,/封装机.*30°.*透明背景/);
});

test('stable bytes and embedded offline representations through the CLI',t=>{
  const path=temporary(t);
  for (const format of ['svg','plan','html']) {
    const a=join(path,'a.'+format), b=join(path,'b.'+format);
    for(const out of [a,b]) {
      const run=cli('render',input,'--format',format,'--out',out);
      assert.equal(run.status,0,run.stderr);
    }
    assert.deepEqual(readFileSync(a),readFileSync(b),format);
  }
  const html=readFileSync(join(path,'a.html'),'utf8');
  assert.match(html,/scene-media:\d+/);
  assert.match(html,/开工条件核查/);
  assert.doesNotMatch(html,/(?:src|href)=["']https?:/);
  const svg=readFileSync(join(path,'a.svg'),'utf8');
  assert.match(svg,/<svg .*viewBox=/);
  const machine=svg.match(/data-object-id="machine"[\s\S]*?data:image\/png;base64,([A-Za-z0-9+/=]+)/)[1];
  const variant=workspace.assets.get('manufacturing.equipment.cnc').variants[0];
  assert.deepEqual(Buffer.from(machine,'base64'),readFileSync(new URL(variant.file,root)));
  const illustratedInput=join(path,'illustrated.json'), illustratedOutput=join(path,'illustrated.svg');
  const illustrated=structuredClone(hero);
  illustrated.render.illustration='assets/illustrations/production-quality-v2.png';
  writeFileSync(illustratedInput,JSON.stringify(illustrated));
  assert.equal(cli('render',illustratedInput,'--out',illustratedOutput).status,0);
  const embedded=readFileSync(illustratedOutput,'utf8').match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)[1];
  assert.deepEqual(Buffer.from(embedded,'base64'),readFileSync(new URL(illustrated.render.illustration,root)));
});

test('external SVG import produces a hashed draft and rejects remote references',t=>{
  const path=temporary(t);
  const input=join(path,'import.json'), graphic=join(path,'sealer.svg');
  const metadata={
    id:'manufacturing.equipment.sealer',version:'1.0.0',name:'封装机',category:'equipment',
    industry:'manufacturing',tags:['包装'],aliases:[],footprint:[1.8,1.1],height:1.6,
    style_profile:'industrial-isometric-v1',source_url:'https://example.org/sealer',license:'CC0-1.0',
    attribution:'示例',directions:{0:'sealer.svg'},
  };
  writeFileSync(input,JSON.stringify(metadata));
  const run=()=>spawnSync('python3',['scripts/import-svg.py',input,path],{cwd,encoding:'utf8'});
  writeFileSync(graphic,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -70 100 90"><image href="https://example.org/sealer.png"/></svg>');
  assert.equal(run().status,1);
  writeFileSync(graphic,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -70 100 90"><rect x="-40" y="-55" width="80" height="55" fill="#678899"/></svg>');
  const result=run();
  assert.equal(result.status,0,result.stderr);
  const asset=JSON.parse(readFileSync(join(result.stdout.trim(),'asset.json'),'utf8'));
  assert.equal(asset.status,'draft');
  assert.deepEqual(asset.anchor,[50,70]);
  assert.match(asset.variants[0].sha256,/^[0-9a-f]{64}$/);
  assert.equal(run().status,1);
});

const rsvg=spawnSync('rsvg-convert',['--version']).status===0;
test('PNG export uses requested size and an alpha channel', {skip:!rsvg}, t=>{
  const out=join(temporary(t),'production.png');
  const run=cli('render',input,'--format','png','--width','640','--out',out);
  assert.equal(run.status,0,run.stderr);
  const png=readFileSync(out);
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),640);
  assert.ok(png.readUInt32BE(20)>300);
  assert.equal(png[25],6);
});
