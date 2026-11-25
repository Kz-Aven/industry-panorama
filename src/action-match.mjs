import { readJSON, validateSchema } from './workspace.mjs';

const fields=['role','action','tool','target'];
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,'');

export function matchAction(workspace,input) {
  validateSchema('action-match',input);
  const hits=readJSON('config/action-assets.json').flatMap(rule=>{
    if(rule.industry && rule.industry!==input.industry) return [];
    const evidence=Object.fromEntries(fields.map(key=>[
      key,rule.when[key].find(term=>normalize(input[key]).includes(normalize(term))),
    ]));
    return fields.every(key=>evidence[key]) ? [{rule,evidence}] : [];
  });
  const scoped=hits.filter(hit=>hit.rule.industry===input.industry && hit.rule.industry);
  const candidates=scoped.length ? scoped : hits;
  if(candidates.length!==1) return {status:candidates.length?'ambiguous':'unmatched',rules:candidates.map(hit=>hit.rule.id)};
  const {rule,evidence}=candidates[0];
  let rotation=null;
  if(input.placement){
    const [x,y]=input.placement.actor, [tx,ty]=input.placement.focus;
    const dx=tx-x,dy=ty-y;
    if(dx||dy) rotation=Math.abs(dx)>=Math.abs(dy)?(dx>0?0:180):(dy>0?90:270);
  }
  const missing=Object.values(rule.assets).filter(id=>{
    const asset=workspace.assets.get(id);
    return !asset || asset.status!==workspace.policy.active_status || asset.style_profile!==workspace.style.id ||
      (id===rule.assets.role && rotation!==null && !asset.supported_directions.includes(rotation));
  });
  if(missing.length) return {status:'missing-assets',rule:rule.id,missing};
  return {status:'matched',rule:rule.id,evidence,assets:rule.assets,pose:rule.pose,rotation};
}
