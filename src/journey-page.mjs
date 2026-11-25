import { readFileSync } from 'node:fs';
import { escape } from './svg.mjs';

const read=file=>readFileSync(new URL('../examples/manufacturing-atlas/'+file,import.meta.url),'utf8');

export function renderJourneyPage(payload) {
  const title=escape((payload.industry ?? '制造业')+'业务全景');
  const subtitle=escape('顺着一笔业务看清上下游，再进入'+(payload.workplace ? '工作区' : '工厂')+'、部门和具体案例。');
  const json=JSON.stringify(payload).replaceAll('<','\\u003c');
  return `<!doctype html>
  <html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title><style>${read('journey.css')}</style></head><body>
  <main>
  <header class="head"><div><h1>${title}</h1><p>${subtitle}</p></div>
  <button class="quiet" type="button" data-view="cases">浏览全部 ${payload.cases.length} 个案例</button></header>
  <div class="nav"><div class="flow-tabs" id="flow-tabs" aria-label="切换业务主线"></div><div class="view-tabs" id="view-tabs" aria-label="切换视图"></div></div>
  <section class="intro"><h2 id="question"></h2><p id="tracked"></p></section>
  <div class="layout"><section class="canvas" id="canvas" aria-label="业务图"></section>
  <aside id="detail" class="detail" aria-label="业务详情" aria-live="polite"></aside></div>
  <footer>以场景案例库的 ${payload.cases.length} 个${escape(payload.industry ?? '制造业')}案例为依据。跨案例关系按典型路径整理，工区与外部场所为示意，实际部门和交付方式随企业而异。</footer>
  </main>
  <script type="application/json" id="map-data">${json}</script>
  <script>${read('journey.js')}</script>
  </body></html>\n`;
}
