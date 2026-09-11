import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSettings, SettingsStore, type SettingsData } from '../src/data';
import { DEFAULT_TEMPLATE } from '../src/template';

test('defaults apply only when settings are absent', () => {
  assert.equal(decodeSettings(null).template, DEFAULT_TEMPLATE);
  assert.equal(decodeSettings({ version: 1, template: '' }).template, '');
  for (const invalid of [{ version: 2, template: '{{vault}}' }, {}, 'bad', { version: 1, template: '{{wrong}}' }]) assert.throws(() => decodeSettings(invalid));
});

test('serializes edits and advances confirmed settings only after persistence succeeds', async () => {
  const saved: SettingsData[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  const store = new SettingsStore(async data => { if (data.template === 'first') await gate; saved.push(data); });
  const first = store.save('first');
  const second = store.save('second');
  await Promise.resolve();
  assert.equal(saved.length, 0);
  assert.equal(store.confirmed.template, DEFAULT_TEMPLATE);
  release(); await Promise.all([first, second]);
  assert.deepEqual(saved.map(data => data.template), ['first', 'second']);
  assert.equal(store.confirmed.template, 'second');
});

test('a failed write preserves confirmed data and does not poison later writes', async () => {
  const store = new SettingsStore(async data => { if (data.template === 'bad') throw Error('Disk unavailable'); });
  await store.save('good');
  await assert.rejects(store.save('bad'), /Disk unavailable/);
  assert.equal(store.confirmed.template, 'good');
  await store.save('recovered');
  assert.equal(store.confirmed.template, 'recovered');
});
