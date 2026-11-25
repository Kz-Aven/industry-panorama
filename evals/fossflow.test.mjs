import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const cli=(...args)=>spawnSync(process.execPath,['src/cli.mjs',...args],{encoding:'utf8'});
const readJSON=path=>JSON.parse(readFileSync(path,'utf8'));

test('FossFLOW export preserves scene and case IDs and batch reports both files', t=>{
  if(spawnSync('rsvg-convert',['--version']).status!==0) return t.skip('rsvg-convert unavailable');
  const dir=mkdtempSync(join(tmpdir(),'composer-fossflow-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const input=resolve('examples/p1/service.json');
  const output=join(dir,'journey.fossflow.json');
  const mappingPath=join(dir,'journey.fossflow.mapping.json');
  const result=cli('export',input,'--format','fossflow','-o',output);
  assert.equal(result.status,0,result.stderr);
  const atlas=readJSON(input), diagram=readJSON(output), mapping=readJSON(mappingPath);
  const [view]=diagram.views;
  assert.equal(view.id,atlas.id);
  assert.deepEqual(view.items.map(item=>item.id),atlas.zones.flatMap(zone=>zone.scene_ids));
  assert.deepEqual(mapping.scenes.map(scene=>scene.cases),atlas.scenes.map(scene=>scene.semantic.cases));
  assert.deepEqual(view.connectors.map(edge=>[edge.id,...edge.anchors.map(anchor=>anchor.ref.item)]),
    atlas.connections.map(edge=>[edge.id,edge.source,edge.target]));
  for(const icon of diagram.icons) {
    const png=Buffer.from(icon.url.split(',')[1],'base64');
    assert.equal(png.toString('ascii',12,16),'IHDR');
    assert.equal(png.readUInt32BE(16),640);
    assert.equal(png.readUInt32BE(20),640);
    assert.equal(png[25],6);
  }
  const manifest=join(dir,'manifest.json');
  writeFileSync(manifest,JSON.stringify({jobs:[{input,format:'fossflow',output:'journey.fossflow.json'}]}));
  const batch=cli('batch',manifest,'-o',join(dir,'batch'));
  assert.equal(batch.status,0,batch.stderr);
  const [job]=readJSON(join(dir,'batch','batch-report.json')).jobs;
  assert.deepEqual(readFileSync(job.output),readFileSync(output));
  assert.deepEqual(readFileSync(job.mapping),readFileSync(mappingPath));
});

test('FossFLOW export requires an Atlas', ()=>{
  const result=cli('export','examples/p1/warehouse.json');
  assert.equal(result.status,1);
  assert.match(result.stderr,/输入是 scene/);
});
