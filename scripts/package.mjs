import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const packageInfo = JSON.parse(await readFile('package.json', 'utf8'));
const versions = JSON.parse(await readFile('versions.json', 'utf8'));
assert.equal(manifest.id, 'window-title');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, packageInfo.version, 'Package and manifest versions must match.');
assert.equal(versions[manifest.version], manifest.minAppVersion, 'The compatibility map must contain this release.');
const source = await readFile('main.js', 'utf8');
assert.ok(source.includes((await readFile('LICENSE', 'utf8')).trim()), 'The bundle must retain its license notice.');
assert.ok(!/require\(["'](?:electron|fs|node:|@electron\/remote)/.test(source), 'The plugin must not import native desktop modules.');
const directory = `dist/${manifest.id}`;
await mkdir(directory, { recursive: true });
const checksums = [];
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  await copyFile(name, `${directory}/${name}`);
  checksums.push(`${createHash('sha256').update(await readFile(name)).digest('hex')}  ${name}`);
}
await writeFile('dist/SHA256SUMS', checksums.join('\n') + '\n');
console.log(`Installable plugin: ${directory}`);
