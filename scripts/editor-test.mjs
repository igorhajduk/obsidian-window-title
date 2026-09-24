import { writeFile } from 'node:fs/promises';
import { job } from './lab-cli.mjs';

const result = await job(`
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const plugin=app.plugins.plugins['window-title'];const previous=plugin.template;const checks=[];
const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));};
const ws=app.workspace;let folder=null;let scratch=null;
try {
app.setting.open();app.setting.openTabById('window-title');await wait(300);
const doc=app.setting.popout.win.document;const ui=()=>doc.querySelector('.window-title-settings');const textarea=()=>ui().querySelector('textarea');
const input=text=>{textarea().value=text;textarea().dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));};
const button=name=>[...ui().querySelectorAll('button')].find(b=>b.textContent===name);
input('{{vault}} / {{title}}');
const grip=ui().querySelector('[data-segment-index="0"] [draggable]');const target=ui().querySelector('[data-segment-index="2"]');
const transfer=new doc.defaultView.DataTransfer();const bounds=target.getBoundingClientRect();grip.dispatchEvent(new doc.defaultView.DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));target.dispatchEvent(new doc.defaultView.DragEvent('drop',{bubbles:true,dataTransfer:transfer,clientY:bounds.bottom-1}));
check('drag events reorder both editors',textarea().value===' / {{title}}{{vault}}',textarea().value);
input('{{vault}}');const before=plugin.template;
textarea().dispatchEvent(new doc.defaultView.CompositionEvent('compositionstart',{bubbles:true}));input('Окно {{title}}');
check('composition keeps committed format until end',plugin.template===before,plugin.template);
textarea().dispatchEvent(new doc.defaultView.CompositionEvent('compositionend',{bubbles:true}));
check('composition end commits valid draft',plugin.template==='Окно {{title}}',plugin.template);
input('prefix REPLACE suffix');textarea().setSelectionRange(7,14);button('Insert element').click();await wait(250);
const picker=plugin.settingTab.editor.picker;const choice=(await picker.getSuggestions('vault')).find(x=>x.segment.key==='vault');picker.onChooseSuggestion(choice);picker.close();
check('insert replaces selection and restores caret',textarea().value==='prefix {{vault}} suffix'&&doc.activeElement===textarea()&&textarea().selectionStart===16,{value:textarea().value,caret:textarea().selectionStart});
input('{{vault');await plugin.store.settle();
await plugin.saveData({version:1,template:'External {{title}}'});await plugin.onExternalSettingsChange();
check('external update preserves unfinished draft',textarea().value==='{{vault'&&plugin.template==='External {{title}}'&&ui().querySelector('.window-title-error').textContent.includes('outside'),{draft:textarea().value,applied:plugin.template});
button('Use last valid format').click();check('discard adopts external format',textarea().value==='External {{title}}',textarea().value);
app.setting.close();await wait(100);
check('settings editor cleans up subscriptions',plugin.subscribers.size===0,plugin.subscribers.size);
await plugin.index.available();
folder=await app.vault.createFolder('Index Scratch');scratch=await app.vault.create('Index Scratch/Only.md','---\\nunique_lab_property: present\\n---\\n');await wait(400);
check('new metadata adds searchable property',(await plugin.index.available()).includes('unique_lab_property'),await plugin.index.available());
await app.vault.rename(folder,'Index Renamed');await wait(300);
check('folder rename retains property',(await plugin.index.available()).includes('unique_lab_property'),await plugin.index.available());
await app.vault.delete(scratch);scratch=null;await wait(300);
check('deleting renamed file removes last property reference',!(await plugin.index.available()).includes('unique_lab_property'),await plugin.index.available());
return {checks,event_input:'Synthetic DOM events; physical pointer and system IME not exercised'};
}finally{
app.setting.close();plugin.setTemplate(previous);plugin.flushSave();await plugin.store.settle();if(scratch)await app.vault.delete(scratch);if(folder)await app.vault.delete(folder,true);
}
`, 90000);
await writeFile('test-results/editor.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
