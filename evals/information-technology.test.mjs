import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/composer.mjs';
import { validateDocument } from '../src/knowledge.mjs';
import { loadWorkspace, missingAssets, readJSON, searchAssets } from '../src/workspace.mjs';

test('information technology pack composes all nine scenes from fifty catalog records',()=>{
  const workspace=loadWorkspace();
  const atlas=readJSON('examples/information-technology/atlas.json');
  const {cases}=readJSON('examples/information-technology/source-data.json');
  assert.equal(workspace.packs.get(atlas.industry).name,'信息技术');
  assert.equal(validateDocument(atlas),'atlas');
  assert.equal(atlas.scenes.length,9);
  assert.equal(atlas.zones.length,3);
  assert.equal(cases.length,50);
  const original=new Map(cases.map(c=>[c.id,c]));
  const seen=new Set();
  const usedAssets=new Set();
  assert.equal(missingAssets(atlas,workspace).missing.length,0);
  for(const scene of atlas.scenes){
    compose(scene,workspace);
    usedAssets.add(scene.scene.platform.asset_id);
    for(const o of scene.scene.objects) usedAssets.add(o.asset_id);
    assert.deepEqual(scene.interaction.case_ids,scene.semantic.cases.map(c=>c.id));
    for(const c of scene.semantic.cases){
      assert.ok(!seen.has(c.id),c.title);
      seen.add(c.id);
      const item=original.get(c.id);
      assert.deepEqual([c.title,c.roles,c.description],[item.title,item.roles.join(' · '),item.pain]);
      assert.equal(c.source_refs.length,1);
      const source=scene.semantic.source_refs.find(ref=>ref.id===c.source_refs[0]);
      assert.equal(source.locator,item.relative+':'+item.line);
      assert.equal(source.uri,item.uri);
    }
  }
  assert.equal(seen.size,original.size);
  const reused=[...usedAssets].filter(id=>id.startsWith('universal.'));
  assert.equal(reused.length,17);
  const rack='information-technology.equipment.server-rack';
  assert.deepEqual([...usedAssets].filter(id=>!id.startsWith('universal.')),[rack]);
  assert.equal(searchAssets(workspace,'机房巡检',atlas.industry)[0].id,rack);
});
