import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { vaultPath } from './lab-cli.mjs';

await mkdir(path.join(vaultPath, '.obsidian/plugins/window-title'), { recursive: true });
await mkdir(path.join(vaultPath, 'Projects'), { recursive: true });
for (const name of ['main.js', 'styles.css', 'manifest.json']) {
  try { await access(`dist/${name}`); await copyFile(`dist/${name}`, path.join(vaultPath, '.obsidian/plugins/window-title', name)); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
async function initial(name, content) {
  try { await writeFile(path.join(vaultPath, name), content, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
await initial('.obsidian/core-plugins.json', JSON.stringify(['file-explorer', 'command-palette', 'graph', 'properties', 'webviewer']));
await initial('.obsidian/community-plugins.json', '[]');
await initial('Welcome.md', '---\nproject: Research\nstatus: draft\npriority: 0\nreviewed: false\ntags:\n  - title\n  - test\n---\n# Title Lab\n\nA disposable vault for window title checks.\n');
await initial('Projects/Planning.md', '---\nproject: Planning\ncustomer name: Example\nstatus: active\n---\n# Planning\n');
await initial('Projects/Кириллица 🪟.md', '# Unicode title\n');
console.log(`Prepared ${vaultPath}`);
