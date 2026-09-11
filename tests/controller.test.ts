import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TitleController } from '../src/title-controller';

function harness(initial: string) {
  let title = initial;
  let records: MutationRecord[] = [];
  let callback: MutationCallback;
  let active = false;
  let queued = false;
  let writes = 0;
  const observer = {
    observe() { active = true; },
    disconnect() { active = false; records = []; },
    takeRecords() { const pending = records; records = []; return pending; },
  } as MutationObserver;
  const doc = {
    get title() { return title; },
    set title(value: string) {
      title = value; writes++;
      if (active) {
        records.push({ type: 'childList' } as MutationRecord);
        if (!queued) {
          queued = true;
          queueMicrotask(() => { queued = false; const pending = observer.takeRecords(); if (active && pending.length) callback(pending, observer); });
        }
      }
    },
    head: { querySelector() { return {}; } },
  } as unknown as Document;
  return { doc, observer: (cb: MutationCallback) => { callback = cb; return observer; }, writes: () => writes };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('restores the latest external title and ignores its own synchronous mutations', async () => {
  const h = harness('First native');
  const controller = new TitleController(h.doc, () => 'Custom', () => assert.fail('Unexpected conflict'), h.observer);
  await flush(); assert.equal(h.doc.title, 'Custom');
  h.doc.title = 'Second native'; await flush();
  assert.equal(h.doc.title, 'Custom');
  controller.dispose(); assert.equal(h.doc.title, 'Second native');
  await flush(); assert.equal(h.doc.title, 'Second native');
});

test('captures core writes even when their text equals the custom title', async () => {
  const h = harness('First native');
  const controller = new TitleController(h.doc, () => 'Next native', () => {}, h.observer);
  await flush();
  h.doc.title = 'Next native'; await flush();
  controller.dispose();
  assert.equal(h.doc.title, 'Next native');
});

test('drains pending native mutations before an immediate disable', async () => {
  const h = harness('First');
  const controller = new TitleController(h.doc, () => 'Custom', () => {}, h.observer);
  await flush();
  h.doc.title = 'Current native';
  controller.dispose(); await flush();
  assert.equal(h.doc.title, 'Current native');
});

test('pending refresh and closed-window teardown cannot write after disposal', async () => {
  const h = harness('Native');
  const controller = new TitleController(h.doc, () => 'Custom', () => {}, h.observer);
  controller.dispose(false); await flush();
  assert.equal(h.doc.title, 'Native'); assert.equal(h.writes(), 0);
});

test('coalesces refreshes and does no idle work', async () => {
  const h = harness('Native');
  const controller = new TitleController(h.doc, () => 'Custom', () => {}, h.observer);
  for (let i = 0; i < 100; i++) controller.refresh();
  await flush(); assert.equal(h.writes(), 1);
  await flush(); assert.equal(h.writes(), 1);
  controller.dispose();
});

test('stops fighting a fast competing title writer', async () => {
  const h = harness('Native'); let conflicts = 0;
  const controller = new TitleController(h.doc, () => 'Custom', () => conflicts++, h.observer);
  await flush();
  for (let i = 0; i < 30; i++) { h.doc.title = `Other ${i}`; await flush(); }
  assert.equal(conflicts, 1); assert.equal(h.doc.title, 'Other 29');
  controller.dispose(); assert.equal(h.doc.title, 'Other 29');
});
