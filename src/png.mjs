import { spawnSync } from 'node:child_process';

export function rasterizeSVG(svg,{width,height}={}) {
  const dims=[['--width',width],['--height',height]].filter(([,value])=>value!==undefined);
  if(dims.some(([,value])=>!/^\d+$/.test(value)||Number(value)<1)) throw new Error('PNG 宽高必须是正整数像素');
  const result=spawnSync('rsvg-convert',[...dims.flat().map(String),...(width&&height?['--keep-aspect-ratio']:[])],{
    input:svg,maxBuffer:64*1024*1024,
  });
  if(result.error?.code==='ENOENT') throw new Error('PNG 导出需要安装 librsvg 的 rsvg-convert');
  if(result.error||result.status!==0) throw new Error(String(result.error ?? result.stderr));
  return result.stdout;
}
