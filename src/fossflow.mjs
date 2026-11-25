import { project } from './geometry.mjs';
import { rasterizeSVG } from './png.mjs';
import { escape,renderScene } from './svg.mjs';

export const FOSSFLOW_TARGET='Abrar74774/FossFLOW@v1.0.6';
export const fossflowMappingPath=path=>path.replace(/\.json$/,'')+'.mapping.json';
const spriteSize=640;
const scale=2.5;
const tileSpacing=5;
const regionPad=2;
const shortName=text=>text.slice(0,100);
const colors=[
  {id:'zone-0',value:'#C5D7D8'},
  {id:'zone-1',value:'#D6D5E4'},
  {id:'zone-2',value:'#D4DDCC'},
  {id:'flow',value:'#386D72'},
  {id:'query',value:'#6F6292'},
];

export function buildFossflow(atlas,plans,illustrations,workspace) {
  const art=atlas.scenes.map((scene,i)=>{
    const plan=plans[i], illustration=illustrations[i];
    const [w,d]=plan.platform.size;
    const svg=renderScene(scene,plan,workspace,false,illustration);
    const pad=workspace.rendering.padding;
    // FossFLOW places the image center on the tile center. Pad around the platform center.
    const pivot=illustration ? [illustration.width/2,illustration.height*.72] :
      project([w/2,d/2,0],plan.pixels_per_unit);
    const [left,top,width,height]=illustration ?
      [-pad,-pad,illustration.width+2*pad,illustration.height+2*pad] : plan.bounds;
    const radius=Math.ceil(Math.max(pivot[0]-left,left+width-pivot[0],pivot[1]-top,top+height-pivot[1]));
    return {svg,pivot,radius};
  });
  const radius=Math.max(...art.map(item=>item.radius));
  const icons=atlas.scenes.map((scene,i)=>{
    const {svg,pivot:[x,y]}=art[i];
    const square=svg.replace(/viewBox="[^"]+" width="[^"]+" height="[^"]+"/,
      `viewBox="${x-radius} ${y-radius} ${radius*2} ${radius*2}" width="${spriteSize}" height="${spriteSize}"`);
    const png=rasterizeSVG(square,{width:spriteSize});
    return {id:'art-'+scene.id,name:shortName(scene.title),url:'data:image/png;base64,'+png.toString('base64'),
      collection:'imported',isIsometric:true,scale};
  });
  const items=atlas.scenes.map(scene=>{
    const description=[scene.description,`业务场景 ID：${scene.id}`,
      scene.semantic.cases?.length?`关联案例：${scene.semantic.cases.length} 个，详见业务映射文件。`:''].filter(Boolean).join('\n');
    return {id:scene.id,name:shortName(scene.title),description:escape(description).slice(0,1000),icon:'art-'+scene.id};
  });

  const nodes=[],rectangles=[],textBoxes=[];
  let startX=0;
  for(const [i,zone] of atlas.zones.entries()){
    const columns=Math.min(3,zone.scene_ids.length);
    const rows=Math.ceil(zone.scene_ids.length/columns);
    zone.scene_ids.forEach((id,index)=>nodes.push({id,
      tile:{x:startX+index%columns*tileSpacing,y:Math.floor(index/columns)*tileSpacing},labelHeight:-150}));
    const from={x:startX-regionPad,y:-regionPad};
    rectangles.push({id:'zone-'+zone.id,color:'zone-'+(i%3),from,
      to:{x:startX+(columns-1)*tileSpacing+regionPad,y:(rows-1)*tileSpacing+regionPad}});
    textBoxes.push({id:'title-'+zone.id,tile:{x:from.x-1,y:from.y-1},content:shortName(zone.title),fontSize:.65,orientation:'X'});
    startX+=columns*tileSpacing+2;
  }
  const connectors=atlas.connections.map(edge=>({
    id:edge.id,color:edge.kind==='query'?'query':'flow',style:edge.kind==='reading_order'?'DASHED':'SOLID',
    width:3.5,showArrow:true,
    labels:[{id:edge.id+'-label',text:edge.label.slice(0,1000),position:50,height:58}],
    anchors:[edge.source,edge.target].map((item,index)=>({id:edge.id+'-'+index,ref:{item}})),
  }));
  const title=shortName(atlas.title);
  const diagram={title,version:'1.0',description:atlas.description.slice(0,1000),
    icons,items,colors,views:[{id:atlas.id,name:title,items:nodes,rectangles,connectors,textBoxes}],fitToView:true};
  const mapping={atlas_id:atlas.id,title:atlas.title,description:atlas.description,target:FOSSFLOW_TARGET,view_id:atlas.id,sprite:{size:spriteSize,anchor:[spriteSize/2,spriteSize/2],scale},
    zones:atlas.zones.map(z=>({id:z.id,fossflow_region_id:'zone-'+z.id,title:z.title,scene_ids:z.scene_ids})),
    scenes:atlas.scenes.map(s=>({scene_id:s.id,fossflow_item_id:s.id,fossflow_icon_id:'art-'+s.id,title:s.title,description:s.description,
      cases:s.semantic.cases ?? [],sources:[...new Map([...(atlas.source_refs ?? []),...s.semantic.source_refs].map(ref=>[ref.id,ref])).values()],
      asset_ids:[...new Set([s.scene.platform.asset_id,...s.scene.objects.map(o=>o.asset_id)])],
    })),
    connections:atlas.connections.map(e=>({id:e.id,fossflow_connector_id:e.id,source:e.source,target:e.target,kind:e.kind,
      label:e.label,source_refs:e.source_refs ?? []})),
  };
  return {diagram,mapping};
}
