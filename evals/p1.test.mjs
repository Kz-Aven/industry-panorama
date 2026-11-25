import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { loadWorkspace, readJSON } from '../src/workspace.mjs';
import { validateDocument } from '../src/knowledge.mjs';
import { compose } from '../src/composer.mjs';
import { matchAction } from '../src/action-match.mjs';

const workspace=loadWorkspace();
const example=name=>readJSON('examples/p1/'+name+'.json');

test('P1 templates use actual slots and both specialized atlas types compose',()=>{
  assert.equal(workspace.templates.size,8);
  const documents=['service','medical','procurement','warehouse'].map(example);
  assert.equal(documents[0].type,'process_journey');
  assert.equal(documents[2].type,'ai_opportunity_map');
  const used=new Set();
  for(const doc of documents){
    validateDocument(doc);
    for(const scene of doc.scenes ?? [doc]){
      used.add(scene.scene.template);
      assert.ok(scene.scene.objects.every(o=>o.slot),scene.id);
      compose(scene,workspace);
    }
  }
  assert.deepEqual([...used].sort(),['customer-reception','meeting-review','monitoring-center','warehouse']);
});

test('work-action matching returns distinct poses, evidence, directions and a clear miss',()=>{
  const inputs=example('actions'),expected=example('matches');
  for(const [id,input] of Object.entries(inputs)) assert.deepEqual(matchAction(workspace,input),expected[id]);
  assert.equal(expected.warehouse.assets.role,'universal.person.worker');
  assert.equal(expected.monitoring.rotation,270);
  assert.equal(expected.intake.assets.role,'medical-health.person.clinician');
  assert.equal(matchAction(workspace,{...inputs.warehouse,tool:'激光干涉仪'}).status,'unmatched');
});

test('batch retains successes and reports missing assets and invalid scene ids',t=>{
  const dir=mkdtempSync(join(tmpdir(),'isometric-batch-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const write=(name,value)=>writeFileSync(join(dir,name),JSON.stringify(value));
  const bad=example('service');
  bad.scenes[0].scene.objects[0].asset_id='unknown.desk';
  bad.scenes[1].scene.objects[1].slot='missing-slot';
  write('bad.json',bad);
  write('good.json',example('warehouse'));
  write('batch.json',{jobs:[{input:'bad.json'},{input:'good.json',format:'plan'}]});
  const out=join(dir,'output');
  const result=spawnSync(process.execPath,['src/cli.mjs','batch',join(dir,'batch.json'),'-o',out],{encoding:'utf8'});
  assert.equal(result.status,1,result.stderr);
  const report=JSON.parse(readFileSync(join(out,'batch-report.json'),'utf8'));
  assert.deepEqual([report.ok,report.failed],[1,1]);
  assert.deepEqual(report.jobs[0].failures.map(f=>[f.scene_id,f.kind]),[
    ['ticket-intake','missing-assets'],['ticket-verify','invalid-scene'],
  ]);
  assert.equal(report.jobs[0].failures[0].missing[0].asset_id,'unknown.desk');
  assert.ok(readFileSync(report.jobs[1].output).length>100);
});
