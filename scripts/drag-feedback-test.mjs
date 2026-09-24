import { writeFile } from 'node:fs/promises';
import { job, value } from './lab-cli.mjs';

const result=await job(`
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const plugin=app.plugins.plugins['window-title'];const previous=plugin.template;
const checks=[];const check=(name,passed)=>{checks.push({name,passed});if(!passed)throw Error(name);};
app.setting.open();app.setting.openTabById('window-title');await wait(250);
const contents=app.setting.popout.win.electronWindow.webContents;const throttling=contents.getBackgroundThrottling();contents.setBackgroundThrottling(false);
try {
const doc=app.setting.popout.win.document;const ui=doc.querySelector('.window-title-settings');const textarea=ui.querySelector('textarea');
const input=text=>{textarea.value=text;textarea.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));};
input('{{vault}} / {{title}}');
const rows=()=>Array.from(ui.querySelectorAll('[data-segment-index]'));
const transfer=new doc.defaultView.DataTransfer();let imageTarget=null;transfer.setDragImage=el=>imageTarget=el;
const drag=(el,type,y)=>el.dispatchEvent(new doc.defaultView.DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:y}));
let first=rows()[0],last=rows()[2];drag(first.querySelector('[draggable]'),'dragstart',first.getBoundingClientRect().top+20);await wait(100);
check('drag image uses entire tile',imageTarget===first);check('source tile fades',first.classList.contains('is-dragging'));
let bounds=last.getBoundingClientRect();drag(last,'dragover',bounds.top+1);check('upper half marks insertion before tile',last.classList.contains('is-drop-before'));
drag(last,'dragover',bounds.bottom-1);check('lower half marks insertion after tile',last.classList.contains('is-drop-after'));
check('hover preserves saved order',plugin.template==='{{vault}} / {{title}}');
await wait(100);
check('tile border is visible',doc.defaultView.getComputedStyle(last).borderTopWidth==='1px');
check('insertion marker is visible',doc.defaultView.getComputedStyle(last,'::after').backgroundColor!=='rgba(0, 0, 0, 0)');
window.__dragShot=await app.setting.popout.win.electronWindow.capturePage().then(i=>i.toDataURL());
drag(last,'drop',bounds.bottom-1);check('drop follows marker',' / {{title}}{{vault}}'===plugin.template);
check('drop clears source and insertion states',!ui.querySelector('.is-dragging,.is-drop-before,.is-drop-after,.is-drag-preview'));
first=rows()[0];last=rows()[2];drag(last.querySelector('[draggable]'),'dragstart',last.getBoundingClientRect().top+20);await wait(30);
drag(first,'dragover',first.getBoundingClientRect().top+1);check('upward drag marks first slot',first.classList.contains('is-drop-before'));
drag(first,'drop',first.getBoundingClientRect().top+1);check('upward drop matches first slot',plugin.template==='{{vault}} / {{title}}');
first=rows()[0];last=rows()[2];drag(first.querySelector('[draggable]'),'dragstart',first.getBoundingClientRect().top+20);await wait(30);
drag(first,'dragover',first.getBoundingClientRect().top+1);check('same position has no misleading marker',!ui.querySelector('.is-drop-before,.is-drop-after'));
drag(last,'dragover',last.getBoundingClientRect().bottom-1);
ui.querySelector('.window-title-segments').dispatchEvent(new doc.defaultView.DragEvent('dragleave',{bubbles:true,relatedTarget:textarea}));
check('leaving builder removes insertion marker',!ui.querySelector('.is-drop-before,.is-drop-after'));
drag(first,'dragend',0);check('cancel clears all drag states',!ui.querySelector('.is-dragging,.is-drag-preview,.is-drop-before,.is-drop-after'));
check('cancel preserves order',plugin.template==='{{vault}} / {{title}}');
return {checks,input:'Synthetic DOM drag events; native pointer drag image not physically exercised'};
}finally{contents.setBackgroundThrottling(throttling);plugin.setTemplate(previous);plugin.flushSave();await plugin.store.settle();}
`,30000);
console.log(result);await writeFile('test-results/drag-feedback.json',JSON.stringify(result,null,2)+'\n');
await writeFile('test-results/drag-feedback.png',Buffer.from((await value('window.__dragShot')).split(',')[1],'base64'));
