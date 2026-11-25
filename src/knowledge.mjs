import { byId, validateSchema } from './workspace.mjs';

function requireRefs(ids, known, context) {
  for (const id of ids ?? []) {
    if (!known.has(id)) throw new Error(`${context} 引用了不存在的 ID：${id}`);
  }
}

export function validateDocument(document) {
  const atlas = Object.hasOwn(document ?? {}, 'scenes');
  validateSchema(atlas ? 'atlas' : 'scene', document);
  const scenes = byId(atlas ? document.scenes : [document], '场景');
  const atlasSources = byId(atlas ? document.source_refs ?? [] : [], '图谱来源');
  if (atlas) {
    const assigned = new Set();
    for (const zone of byId(document.zones, '分区').values()) {
      requireRefs(zone.scene_ids, scenes, zone.id);
      for (const id of zone.scene_ids) {
        if (assigned.has(id)) throw new Error(`场景属于多个分区：${id}`);
        assigned.add(id);
      }
    }
    requireRefs(scenes.keys(), assigned, '分区');
    requireRefs([document.interaction?.default_scene_id].filter(Boolean), scenes, '默认场景');
    for (const edge of byId(document.connections, '连接').values()) {
      requireRefs([edge.source, edge.target], scenes, edge.id);
      if (edge.source === edge.target) throw new Error(`连接指向原场景：${edge.id}`);
      requireRefs(edge.source_refs, atlasSources, edge.id);
    }
    for (const note of byId(document.annotations, '标注').values()) {
      requireRefs([note.scene_id].filter(Boolean), scenes, note.id);
      requireRefs(note.source_refs, atlasSources, note.id);
    }
    for (const layer of byId(document.layers ?? [], '知识层').values()) requireRefs(layer.source_refs, atlasSources, layer.id);
  }
  for (const scene of scenes.values()) {
    const { semantic } = scene;
    const sources = new Map([...atlasSources, ...byId(semantic.source_refs, '场景来源')]);
    const roles = byId(semantic.roles, '角色');
    const actions = byId(semantic.actions, '动作');
    const entities = byId([...semantic.roles, ...semantic.business_objects, ...semantic.systems], '业务语义');
    const references = byId([...entities.values(), ...actions.values()], '语义');
    const cases = byId(semantic.cases ?? [], '案例');
    const objects = byId(scene.scene.objects, '物体');
    for (const action of actions.values()) {
      requireRefs([action.actor],roles,action.id);
      requireRefs([action.target,action.output].filter(Boolean),entities,action.id);
    }
    const relations = byId(semantic.relations ?? [], '关系');
    for (const relation of relations.values()) requireRefs([relation.source,relation.target],references,relation.id);
    for (const item of [...references.values(),...relations.values(),...cases.values()]) requireRefs(item.source_refs,sources,item.id);
    requireRefs(scene.interaction.case_ids,cases,scene.id);
    for (const object of objects.values()) {
      requireRefs([object.action].filter(Boolean),actions,object.id);
      requireRefs([object.semantic_ref].filter(Boolean),references,object.id);
      requireRefs([object.support,object.target].filter(Boolean),objects,object.id);
      requireRefs(object.interaction?.case_ids,cases,object.id);
      if (/\p{Extended_Pictographic}/u.test(object.asset_id+' '+(object.label ?? ''))) {
        throw new Error(`物体标注包含 Emoji：${object.id}`);
      }
    }
  }
  return atlas ? 'atlas' : 'scene';
}
