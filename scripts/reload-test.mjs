import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { evaluate, job, value } from './lab-cli.mjs';

const template='{{frontmatter["project"]}} — {{vault}} — {{title}}';
const previous=await value("app.plugins.plugins['window-title'].template");
try {
  await job(`app.setting.close();const leaf=app.workspace.getMostRecentLeaf(app.workspace.rootSplit);await leaf.openFile(app.vault.getAbstractFileByPath('Welcome.md'));app.workspace.setActiveLeaf(leaf,{focus:true});const p=app.plugins.plugins['window-title'];p.setTemplate(${JSON.stringify(template)});p.flushSave();await p.store.settle();return true;`);
  await evaluate("window.__titleLabReloadMarker=true;setTimeout(()=>location.reload(),100);'scheduled guarded vault reload'");
  let current=null;
  for(let attempt=0;attempt<40;attempt++) {
    await new Promise(r=>setTimeout(r,500));
    try {
      current=await value("({reloaded:!window.__titleLabReloadMarker,loaded:app.workspace.layoutReady,template:app.plugins.plugins['window-title']?.template,title:document.title,native:window.electronWindow.getTitle()})");
      if(current.reloaded&&current.loaded&&current.template===template&&current.title==='Research — Title Lab — Welcome')break;
    }catch { /* The renderer is unavailable briefly during its own reload. */ }
  }
  assert.equal(current?.reloaded,true);
  assert.equal(current?.template,template);
  assert.equal(current?.title,'Research — Title Lab — Welcome');
  assert.equal(current?.native,current?.title);
  const result={passed:true,operation:'Reload dedicated vault renderer; full application restart not tested',...current};
  await writeFile('test-results/reload.json',JSON.stringify(result,null,2)+'\n');
  console.log(result);
}finally {
  await job(`const p=app.plugins.plugins['window-title'];p.setTemplate(${JSON.stringify(previous)});p.flushSave();await p.store.settle();return true;`);
}
