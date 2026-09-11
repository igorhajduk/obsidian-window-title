import { writeFile } from 'node:fs/promises';
import { job } from './lab-cli.mjs';
const result=await job(`
const wait=ms=>new Promise(r=>setTimeout(r,ms));const errors=[];let phase='';let sizes=[];
const listener=e=>errors.push({phase,message:e.message});window.addEventListener('error',listener);
try {
app.setting.close();await wait(500);await app.plugins.disablePlugin('window-title');phase='disabled appearance';app.setting.open();app.setting.openTabById('appearance');await wait(500);
await app.plugins.enablePlugin('window-title');phase='enabled appearance';app.setting.openTabById('appearance');await wait(500);
phase='enabled plugin';app.setting.openTabById('window-title');await wait(500);
const doc=app.setting.popout.win.document;const root=doc.querySelector('.window-title-settings');
for(let i=0;i<5;i++){sizes.push({root:root.getBoundingClientRect().height,parent:root.parentElement.getBoundingClientRect().height,parentHTML:root.parentElement.outerHTML.slice(0,350)});await wait(50);}
phase='plugin without styles';const sheet=[...doc.querySelectorAll('style')].find(s=>s.textContent.includes('.window-title-settings'));if(sheet)sheet.disabled=true;await wait(500);if(sheet)sheet.disabled=false;
return {errors,sizes};
}finally{app.setting.close();window.removeEventListener('error',listener);if(!app.plugins.plugins['window-title'])await app.plugins.enablePlugin('window-title');}
`,60000);
await writeFile('test-results/settings-layout.json',JSON.stringify(result,null,2)+'\n');
console.log(result.errors.reduce((s,e)=>(s[e.phase]=(s[e.phase]??0)+1,s),{}));console.log(result.sizes);
