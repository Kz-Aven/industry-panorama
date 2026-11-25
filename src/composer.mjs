import { brick, extent, project, round } from './geometry.mjs';
import { validateSchema } from './workspace.mjs';

const tolerance = .001;

export function compose(scene, workspace) {
  const { objects, platform, template:templateId } = scene.scene;
  const template = workspace.templates.get(templateId);
  if (!template) throw new Error(`模板不存在：${templateId}`);
  const floor = workspace.assets.get(platform.asset_id);
  if (floor.category !== 'platform' || !floor.colors) throw new Error(`底板素材缺少 platform 类型或面色：${floor.id}`);
  workspace.local.load(floor, 0);
  const [width, depth] = platform.size;
  const unit = workspace.rendering.pixels_per_unit;
  const lookup = new Map(objects.map(o=>[o.id,o]));
  const placed = new Map();
  const resolving = new Set();
  function place(object) {
    if (placed.has(object.id)) return placed.get(object.id);
    if (resolving.has(object.id)) throw new Error(`支撑关系成环：${object.id}`);
    resolving.add(object.id);
    const asset = workspace.assets.get(object.asset_id);
    if (asset.category === 'platform') throw new Error(`底板素材应配置在 scene.platform：${object.id}`);
    const rotation = object.rotation ?? 0;
    const scale = object.scale ?? 1;
    const position = object.position ?? template.slots[object.slot ?? object.id];
    if (!position) throw new Error(`物体缺少坐标或有效模板槽位：${object.id}`);
    const [x,y,zOffset] = position;
    if (zOffset !== 0) throw new Error(`使用 support 安放高处物体，坐标 z 应为 0：${object.id}`);
    const parent = object.support ? place(lookup.get(object.support)) : null;
    const surface = parent && workspace.assets.get(parent.asset_id).surface_height;
    if (parent && !surface) throw new Error(`素材没有可承托表面：${object.support}`);
    const z = parent ? parent.position[2]+surface*parent.scale : 0;
    const [w,d] = (rotation%180 ? [...asset.footprint].reverse() : asset.footprint).map(n=>n*scale);
    const box = [x-w/2,y-d/2,z,x+w/2,y+d/2,z+asset.height*scale];
    const support = parent?.box ?? [0,0,0,width,depth,0];
    if ([0,1].some(i=>box[i]<support[i]-tolerance || box[i+3]>support[i+3]+tolerance)) {
      throw new Error(`物体超出${parent ? '支撑面 '+parent.id : '底板'}：${object.id}`);
    }
    const { anchor, view_box } = asset.variants[rotation];
    workspace.local.load(asset,rotation);
    const screen = project([x,y,z],unit).map(round);
    const rect = [
      screen[0]-anchor[0]*scale,screen[1]-anchor[1]*scale,
      view_box[2]*scale,view_box[3]*scale,
    ].map(round);
    const result = { id:object.id, asset_id:asset.id, rotation, position:[x,y,round(z)], scale, screen, rect, box };
    placed.set(object.id,result);
    resolving.delete(object.id);
    return result;
  }
  const entries = objects.map(place);
  const predecessors = new Map(entries.map(o=>[o.id,new Set(lookup.get(o.id).support ? [lookup.get(o.id).support] : [])]));
  for (const [i,a] of entries.entries()) {
    for (const b of entries.slice(i+1)) {
      const aBehind = [0,1,2].map(axis=>a.box[axis+3]<=b.box[axis]+tolerance);
      const bBehind = [0,1,2].map(axis=>b.box[axis+3]<=a.box[axis]+tolerance);
      const supported = lookup.get(a.id).support === b.id || lookup.get(b.id).support === a.id;
      if (!supported && !aBehind.includes(true) && !bBehind.includes(true)) throw new Error(`占地和高度重叠：${a.id} / ${b.id}`);
      // Use separation in the floor plane only when the projections can overlap.
      const overlap = [0,1].every(axis=> Math.min(a.rect[axis]+a.rect[axis+2],b.rect[axis]+b.rect[axis+2]) > Math.max(a.rect[axis], b.rect[axis]));
      if (!overlap || supported) continue;
      if (aBehind.slice(0,2).includes(true) && !bBehind.slice(0,2).includes(true)) predecessors.get(b.id).add(a.id);
      if (bBehind.slice(0,2).includes(true) && !aBehind.slice(0,2).includes(true)) predecessors.get(a.id).add(b.id);
      if (aBehind[2] && !bBehind[2]) predecessors.get(b.id).add(a.id);
      if (bBehind[2] && !aBehind[2]) predecessors.get(a.id).add(b.id);
    }
  }
  const queue = entries.sort((a,b)=>
    a.position[0]+a.position[1]-b.position[0]-b.position[1] || a.id.localeCompare(b.id));
  const ordered = [];
  while (queue.length) {
    const index = queue.findIndex(o=>predecessors.get(o.id).size===0);
    if (index === -1) throw new Error('遮挡顺序成环，请分开重叠的投影或调整槽位');
    const [next] = queue.splice(index,1);
    ordered.push(next);
    for (const pending of queue) predecessors.get(pending.id).delete(next.id);
  }
  const points = brick(0,0,-platform.height,width,depth,platform.height,floor.colors[0],unit,floor.colors).points;
  for (const {rect:[x,y,w,h]} of ordered) points.push([x,y],[x+w,y+h]);
  const plan = {
    scene_id:scene.id, pixels_per_unit:unit, bounds:extent(points,workspace.rendering.padding),
    platform:{size:platform.size,height:platform.height,colors:floor.colors}, objects:ordered,
  };
  validateSchema('render-plan',plan);
  return plan;
}
