import { readFileSync } from 'node:fs';
import { root } from './workspace.mjs';
import { brick, project, polygon, round } from './geometry.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[c]);
export const svgURL = svg => 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
const header = ([x,y,w,h],title) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" role="img"><title>${escape(title)}</title>`;

export function loadIllustration(path) {
  const png = readFileSync(new URL(path,root));
  if (png.length < 33 || png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' ||
      png.toString('ascii',12,16) !== 'IHDR' || !png.readUInt32BE(16) || !png.readUInt32BE(20)) {
    throw new Error(`场景插画不是有效 PNG：${path}`);
  }
  return {width:png.readUInt32BE(16),height:png.readUInt32BE(20),png};
}

export function renderScene(scene, plan, workspace, labels = scene.render.show_labels, illustration) {
  if (illustration) {
    const {width,height,png}=illustration;
    const padding=workspace.rendering.padding;
    const caption=labels ? `<text x="${width/2}" y="${height+28}" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#283e49">${escape(scene.title)}</text>` : '';
    return header([-padding,-padding,width+2*padding,height+2*padding+(labels?38:0)],scene.title)+
      `<image width="${width}" height="${height}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>`+caption+'</svg>';
  }

  const unit = plan.pixels_per_unit;
  const {size:[w,d],height,colors} = plan.platform;
  const floor = brick(0,0,-height,w,d,height,colors[0],unit,colors);
  const line = (a,b,style) => {
    const [x1,y1] = project(a,unit).map(round), [x2,y2] = project(b,unit).map(round);
    return `<path d="M${x1},${y1} L${x2},${y2}" ${style}/>`;
  };
  let grid = '';
  const office=scene.scene.platform.asset_id.endsWith('.office');
  const seam=office?'stroke="#5e4b34" stroke-opacity=".095"':'stroke="#436072" stroke-opacity=".085"';
  const step=office?.43:1;
  for (let y=step; y<d; y+=step) grid+=line([0,y,0],[w,y,0],seam);
  if (office) {
    for(let row=0; row*step<d; row++) {
      for(let x=.8+(row%3)*.7; x<w; x+=2.6) {
        grid+=line([x,row*step,0],[x,Math.min(d,(row+1)*step),0],seam);
      }
    }
  } else {
    for(let x=1; x<w; x++) grid+=line([x,0,0],[x,d,0],seam);
  }
  const [x,y,bw,bh] = plan.bounds;
  const floorOutline = floor.points.slice(4).map(([x,y])=>[x+5,y+height*unit+7]);
  const accent = scene.scene.platform.asset_id.endsWith('.industrial') ?
    line([.37,d-.38,0],[w-.37,d-.38,0],'stroke="#b68b45" stroke-width="2" stroke-opacity=".74" stroke-dasharray="10 4"') : '';
  const objects = new Map(scene.scene.objects.map(o=>[o.id,o]));
  const contactShadows = plan.objects.filter(o=>o.position[2]===0).map(o=>{
    const [x,y,,right,bottom] = o.box;
    const corners = [[x,y],[right,y],[right,bottom],[x,bottom]].map(p=>project([...p,0],unit));
    return polygon(corners,'#283c45');
  }).join('');
  const art = plan.objects.map(o=>{
    const [x,y,w,h]=o.rect;
    const object = objects.get(o.id);
    const { mime,data } = workspace.local.load(workspace.assets.get(o.asset_id),o.rotation);
    const alignment=mime==='image/png'?' preserveAspectRatio="xMidYMax meet"':'';
    return `<g data-object-id="${o.id}"${object.semantic_ref ? ` data-semantic-ref="${object.semantic_ref}"` : ''}><title>${escape(object.label ?? workspace.assets.get(o.asset_id).name)}</title><image x="${x}" y="${y}" width="${w}" height="${h}"${alignment} xlink:href="data:${mime};base64,${data.toString('base64')}"/></g>`;
  }).join('');
  const caption = labels ? `<text x="${x+bw/2}" y="${y+bh+20}" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#283e49">${escape(scene.title)}</text>` : '';
  const materials=`<defs><linearGradient id="floor-sheen" x1="10%" y1="0%" x2="80%" y2="100%"><stop stop-color="white" stop-opacity=".23"/><stop offset="1" stop-color="#152b43" stop-opacity=".16"/></linearGradient>
    <filter id="contact"><feGaussianBlur stdDeviation="1.3"/></filter></defs>`;
  return header([x,y,bw,bh+(labels?35:0)],scene.title)+materials+
    `<g opacity=".12">${polygon(floorOutline,'#293c43')}</g>`+floor.svg+
    polygon(floor.points.slice(4),'url(#floor-sheen)')+grid+accent+
    `<g opacity=".14" filter="url(#contact)">${contactShadows}</g>`+art+caption+'</svg>';
}

export function arrangeAtlas(atlas, {featured=false,compact=false}={}) {
  const cardWidth=featured?690:328, cardHeight=featured?444:254, gap=50, padding=30;
  const columns=compact?1:Math.min(3, Math.max(...atlas.zones.map(z=>z.scene_ids.length)));
  const cards=[], zones=[];
  let y=padding;
  for (const zone of atlas.zones) {
    zones.push({zone,x:padding,y});
    y+=53;
    zone.scene_ids.forEach((id,i)=>cards.push({
      id,x:padding+(i%columns)*(cardWidth+gap),y:y+Math.floor(i/columns)*(cardHeight+gap),w:cardWidth,h:cardHeight,
    }));
    y+=Math.ceil(zone.scene_ids.length/columns)*(cardHeight+gap)+20;
  }
  return {cards,zones,width:columns*(cardWidth+gap)-gap+2*padding,height:y-gap};
}

export function connectionMarkup(atlas, layout, labels, marker='arrow') {
  const cards = new Map(layout.cards.map(c=>[c.id,c]));
  return `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#678d90"/></marker></defs>`+
    atlas.connections.map(edge=>{
      const a=cards.get(edge.source), b=cards.get(edge.target);
      const sameRow=a.y===b.y;
      const left=a.x<b.x;
      const start=sameRow?[a.x+(left?a.w:0),a.y+a.h/2]:[a.x+a.w/2,a.y+(a.y<b.y?a.h:0)];
      const end=sameRow?[b.x+(left?0:b.w),b.y+b.h/2]:[b.x+b.w/2,b.y+(a.y<b.y?0:b.h)];
      const mid = sameRow ? (start[0]+end[0])/2 : (start[1]+end[1])/2;
      const path = sameRow ? `M${start} H${end[0]}` : `M${start} V${mid} H${end[0]} V${end[1]}`;
      const text=labels && !sameRow ? `<text x="${(start[0]+end[0])/2}" y="${mid-5}" text-anchor="middle" font-size="12" fill="#46656b">${escape(edge.label)}</text>` : '';
      return `<g data-connection-id="${edge.id}"><title>${escape(edge.label)}</title><path d="${path}" stroke="#678d90" stroke-width="2" ${edge.kind==='reading_order'?'stroke-dasharray="4 4"':''} marker-end="url(#${marker})" fill="none"/>${text}</g>`;
    }).join('');
}

export function renderAtlasSVG(atlas, images) {
  const layout = arrangeAtlas(atlas);
  const scenes = new Map(atlas.scenes.map(s=>[s.id,s]));
  return header([0,0,layout.width,layout.height],atlas.title)+
    `<g font-family="sans-serif" fill="#283e49">${connectionMarkup(atlas,layout,true)}`+
    layout.zones.map(({zone,x,y})=>`<text x="${x}" y="${y+25}" font-size="22">${escape(zone.title)}</text>`).join('')+
    layout.cards.map(c=>`<g data-scene-id="${c.id}"><image x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h-28}" xlink:href="${svgURL(images.get(c.id))}"/><text x="${c.x+c.w/2}" y="${c.y+c.h-8}" text-anchor="middle" font-size="18">${escape(scenes.get(c.id).title)}</text></g>`).join('')+
    '</g></svg>';
}
