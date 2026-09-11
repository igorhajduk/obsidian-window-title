import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PropertyNames } from '../src/property-names';

test('retains a key until its last file reference is removed', () => {
  const index = new PropertyNames();
  index.replace('A.md', ['project', 'title']);
  index.replace('B.md', ['project']);
  index.remove('A.md');
  assert.deepEqual(index.names(), ['project']);
  index.remove('B.md');
  assert.deepEqual(index.names(), []);
});

test('replacement and rename do not inflate key counts', () => {
  const index = new PropertyNames();
  index.replace('A.md', ['project', 'project']);
  index.replace('A.md', ['status']);
  assert.deepEqual(index.names(), ['status']);
  index.remove('A.md'); index.replace('Folder/A.md', ['status']);
  index.remove('Folder/A.md');
  assert.deepEqual(index.names(), []);
});
