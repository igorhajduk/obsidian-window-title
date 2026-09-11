import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTemplate, serializeSegments, renderTitle, propertyText, MAX_TITLE_LENGTH, type Segment, type TitleContext } from '../src/template';

const context: TitleContext = {
  vault: 'Work', title: 'Planning', filename: 'Planning.md', basename: 'Planning', folder: 'Projects', filepath: 'Projects/Planning.md',
  frontmatter: { project: 'Apollo', 'customer name': 'Example', 'a.b': 0, 'quote"}}key': false, tags: ['one', 'two'], configuration: { nested: true } },
};

test('renders all built-ins and repeats without parsing replacement text', () => {
  assert.equal(renderTitle(parseTemplate('{{vault}} — {{title}} · {{filepath}} {{vault}}'), context), 'Work — Planning · Projects/Planning.md Work');
  assert.equal(renderTitle(parseTemplate('{{title}}{{title}}'), { ...context, title: '{{vault}}' }), '{{vault}}{{vault}}');
  assert.equal(renderTitle(parseTemplate('{{filename}} {{basename}} {{folder}}'), context), 'Planning.md Planning Projects');
});

test('missing metadata preserves literal separators and falsy values', () => {
  assert.equal(renderTitle(parseTemplate('{{vault}} — {{frontmatter["absent"]}}'), context), 'Work —');
  assert.equal(renderTitle(parseTemplate('{{frontmatter["a.b"]}} {{frontmatter["quote\\\"}}key"]}}'), context), '0 false');
  assert.equal(renderTitle(parseTemplate('{{frontmatter["missing"]}}'), context), 'Work');
  assert.equal(renderTitle([], context), 'Work');
});

test('property keys preserve punctuation, braces, quotes, and Unicode', () => {
  for (const key of ['customer name', 'a.b', 'quote"}}key', 'проект 🪟', '__proto__', 'x\\y', 'line\nbreak']) {
    const segments: Segment[] = [{ type: 'property', key }];
    assert.deepEqual(parseTemplate(serializeSegments(segments)), segments);
  }
  assert.equal(renderTitle([{ type: 'property', key: '__proto__' }], context), 'Work');
});

test('parser and serializer preserve literal values and adjacent/repeated elements', () => {
  const fragments = [' ', ' — ', '{{vault}}', '{', '}', '\\', 'C:\\Projects', '🪟 Кириллица', '"quoted"', '\\{{x}}'];
  for (const text of fragments) {
    const segments: Segment[] = [{ type: 'text', value: text }, { type: 'builtin', key: 'vault' }, { type: 'text', value: text }];
    assert.deepEqual(parseTemplate(serializeSegments(segments)), segments);
  }
  const template = 'prefix {{ vault }}{{title}} — {{frontmatter[ "customer name" ]}} suffix';
  assert.equal(renderTitle(parseTemplate(serializeSegments(parseTemplate(template))), context), renderTitle(parseTemplate(template), context));
});

test('normalizes adjacent text without changing output', () => {
  const segments: Segment[] = [{ type: 'text', value: 'A' }, { type: 'text', value: '' }, { type: 'text', value: 'B' }];
  assert.deepEqual(parseTemplate(serializeSegments(segments)), [{ type: 'text', value: 'AB' }]);
});

test('rejects malformed or unsupported expressions without executing them', () => {
  for (const source of ['{{', '{{vault}', '{{unknown}}', '{{#if title}}', '{{frontmatter.project}}', '{{frontmatter[""]}}', '{{frontmatter["\\q"]}}', '{{title.toUpperCase()}}']) {
    assert.throws(() => parseTemplate(source));
  }
  assert.throws(() => parseTemplate('x'.repeat(16385)));
});

test('metadata conversion handles structured data, missing fields, and control characters', () => {
  assert.equal(propertyText(['one', 0, false]), 'one, 0, false');
  assert.equal(propertyText({ nested: ['one', false] }), '{"nested":["one",false]}');
  assert.equal(propertyText('A\r\nB\tC\0'), 'A B C');
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.equal(propertyText(cycle), '');
});

test('long output stays bounded and does not split UTF-16 surrogate pairs', () => {
  const title = renderTitle([{ type: 'builtin', key: 'title' }], { vault: 'Vault', title: '🪟'.repeat(5000) });
  assert.equal(Array.from(title).length, MAX_TITLE_LENGTH);
  assert.equal(title, '🪟'.repeat(MAX_TITLE_LENGTH));
});

test('property values are local to the selected context', () => {
  const format = parseTemplate('{{vault}} / {{frontmatter["project"]}} / {{title}}');
  assert.equal(renderTitle(format, context), 'Work / Apollo / Planning');
  assert.equal(renderTitle(format, { vault: 'Work', title: 'Graph' }), 'Work / / Graph');
});
