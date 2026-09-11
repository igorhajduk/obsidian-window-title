import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const version = process.argv[2];
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
assert.match(version ?? '', /^\d+\.\d+\.\d+$/);
assert.equal(version, manifest.version, 'The release tag must exactly match the manifest version.');
const notes = (await readFile(`docs/releases/${version}.md`, 'utf8')).trim();
assert.ok(notes, 'The release must have prepared notes.');
process.stdout.write(notes + '\n');
