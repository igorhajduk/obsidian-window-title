import { mkdir, writeFile } from 'node:fs/promises';
import { job, value } from './lab-cli.mjs';

console.log('Environment', await value('({version:app.getAppTitle(),path:app.vault.adapter.basePath})'));
const result = await job(`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const workspace = app.workspace;
const originalLeaf = workspace.getMostRecentLeaf(workspace.rootSplit);
const main = workspace.getLeaf('tab');
const pops = [];
const controllers = [];
const checks = [];
const openedSettings = !app.setting.popout;
const nativeExpected = container => app.getAppTitle(workspace.getMostRecentLeaf(container)?.getDisplayText().trim() ?? '');
function attach(container) {
  const doc = container.doc;
  let baseline = doc.title;
  let disposed = false;
  let writes = 0;
  let custom = () => 'CUSTOM::' + workspace.getMostRecentLeaf(container)?.getDisplayText();
  const observe = new container.win.MutationObserver(records => {
    if (!disposed && records.length) { baseline = doc.title; apply(); }
  });
  function apply() {
    if (disposed) return;
    if (observe.takeRecords().length) baseline = doc.title;
    const text = custom();
    if (doc.title !== text) { doc.title = text; writes++; observe.takeRecords(); }
  }
  observe.observe(doc.head.querySelector('title'), {childList:true,subtree:true,characterData:true});
  apply();
  const controller = { container, apply, baseline:()=>baseline, writes:()=>writes, setCustom:fn=>{custom=fn;apply();}, stop:()=>{if(disposed)return;if(observe.takeRecords().length)baseline=doc.title;disposed=true;observe.disconnect();doc.title=baseline;} };
  controllers.push(controller);
  return controller;
}
function check(name, condition, info) { checks.push({name,passed:!!condition,info}); if(!condition)throw Error(name+': '+JSON.stringify(info)); }
try {
  await main.openFile(app.vault.getAbstractFileByPath('Welcome.md'));
  for(const path of ['Projects/Planning.md','Projects/Кириллица 🪟.md']) {
    const leaf=workspace.openPopoutLeaf();pops.push(leaf);await leaf.openFile(app.vault.getAbstractFileByPath(path));
  }
  await sleep(400);
  for(const container of [workspace.rootSplit,...pops.map(l=>l.getContainer())]) attach(container);
  await sleep(150);
  for(const c of controllers) check('native propagation',c.container.win.electronWindow.getTitle()===c.container.doc.title,{native:c.container.win.electronWindow.getTitle(),document:c.container.doc.title});
  await main.openFile(app.vault.getAbstractFileByPath('Projects/Planning.md'));
  await sleep(400);
  check('main content switch',controllers[0].baseline()===nativeExpected(workspace.rootSplit),controllers[0].baseline());
  await pops[0].openFile(app.vault.getAbstractFileByPath('Welcome.md'));
  await sleep(400);
  check('popout content switch',controllers[1].baseline()===nativeExpected(pops[0].getContainer()),controllers[1].baseline());
  const original=app.vault.getAbstractFileByPath('Projects/Кириллица 🪟.md');
  await app.vault.rename(original,'Projects/Renamed 🪟.md');await sleep(400);
  check('rename baseline',controllers[2].baseline()===nativeExpected(pops[1].getContainer()),controllers[2].baseline());
  await app.vault.rename(original,'Projects/Кириллица 🪟.md');await sleep(300);
  controllers[0].setCustom(()=>app.getAppTitle('Welcome'));
  await main.openFile(app.vault.getAbstractFileByPath('Welcome.md'));await sleep(400);
  check('equal custom and next native',controllers[0].baseline()===nativeExpected(workspace.rootSplit),controllers[0].baseline());
  workspace.setActiveLeaf(main,{focus:true});workspace.rootSplit.win.focus();
  const graph=workspace.getLeaf('tab');await graph.setViewState({type:'graph',active:true});workspace.setActiveLeaf(graph,{focus:true});await sleep(400);
  check('graph selected',workspace.getMostRecentLeaf(workspace.rootSplit)===graph,graph.view.getViewType());
  check('non-file view baseline',controllers[0].baseline()===nativeExpected(workspace.rootSplit),controllers[0].baseline());
  graph.detach();await sleep(300);
  app.setting.open();await sleep(300);
  check('settings focus preserves baseline',controllers[0].baseline()===nativeExpected(workspace.rootSplit),controllers[0].baseline());
  const before=controllers.map(c=>c.writes());await sleep(700);
  check('no idle writes',controllers.every((c,i)=>c.writes()===before[i]),before);
  for(const c of controllers) {c.stop();await sleep(80);check('restore current native',c.container.doc.title===nativeExpected(c.container),{actual:c.container.doc.title,expected:nativeExpected(c.container)});}
  return {checks,platform:process.platform,electron:process.versions.electron};
} finally {
  controllers.forEach(c=>c.stop());
  if(openedSettings)app.setting.close();
  for(const leaf of pops)leaf.detach();
  main.detach();
  if(originalLeaf)workspace.setActiveLeaf(originalLeaf);
}
`, 60000);
await mkdir('test-results', { recursive: true });
await writeFile('test-results/title-spike.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
