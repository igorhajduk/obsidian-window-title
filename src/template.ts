export const ELEMENTS = [
  { key: 'vault', name: 'Vault name', description: 'The name of this vault.' },
  { key: 'title', name: 'Tab title', description: 'The selected tab in each window, including non-file views.' },
  { key: 'filename', name: 'File name', description: 'File name including its extension.' },
  { key: 'basename', name: 'File name without extension', description: 'The base name of the selected file.' },
  { key: 'folder', name: 'Folder path', description: 'Parent folder relative to the vault.' },
  { key: 'filepath', name: 'File path', description: 'Complete path relative to the vault.' },
] as const;

export type Builtin = typeof ELEMENTS[number]['key'];
export type Segment = { type: 'text'; value: string } | { type: 'builtin'; key: Builtin } | { type: 'property'; key: string };
export interface TitleContext {
  vault: string;
  title: string;
  filename?: string;
  basename?: string;
  folder?: string;
  filepath?: string;
  frontmatter?: Record<string, unknown>;
}
export const DEFAULT_TEMPLATE = '{{vault}} — {{title}}';
export const MAX_TEMPLATE_LENGTH = 16384;
export const MAX_TITLE_LENGTH = 2048;

export class TemplateError extends Error {
  constructor(message: string, public readonly position: number) {
    super(`${message} (character ${position + 1})`);
    this.name = 'TemplateError';
  }
}

export function parseTemplate(source: string): Segment[] {
  if (source.length > MAX_TEMPLATE_LENGTH) throw new TemplateError(`Keep the template under ${MAX_TEMPLATE_LENGTH} characters.`, MAX_TEMPLATE_LENGTH);
  const result: Segment[] = [];
  let literal = '';
  const flush = () => { if (literal) { result.push({ type: 'text', value: literal }); literal = ''; } };
  for (let i = 0; i < source.length;) {
    if (source[i] === '\\' && ['\\', '{', '}'].includes(source[i + 1] ?? '')) {
      literal += source[i + 1]; i += 2; continue;
    }
    if (!source.startsWith('{{', i)) { literal += source[i]; i++; continue; }
    flush();
    const start = i;
    let end = i + 2;
    let quoted = false;
    let escaped = false;
    for (; end < source.length; end++) {
      const c = source[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (source.startsWith('}}', end)) break;
    }
    if (end >= source.length) throw new TemplateError('Close this element with }}.', start);
    const token = source.slice(i + 2, end).trim();
    const builtin = ELEMENTS.find(element => element.key === token);
    if (builtin) result.push({ type: 'builtin', key: builtin.key });
    else {
      const match = /^frontmatter\[\s*("(?:[^"\\]|\\.)*")\s*\]$/s.exec(token);
      if (!match) throw new TemplateError('Choose an available element, or use frontmatter["property"].', start);
      let key: unknown;
      try { key = JSON.parse(match[1]) as unknown; } catch { throw new TemplateError('Use a valid quoted property name.', start); }
      if (typeof key !== 'string' || !key.length) throw new TemplateError('Enter a property name.', start);
      result.push({ type: 'property', key });
    }
    i = end + 2;
  }
  flush();
  return result;
}

export function serializeSegments(segments: readonly Segment[]): string {
  return segments.map(segment => {
    if (segment.type === 'text') return segment.value.replace(/[\\{}]/g, '\\$&');
    if (segment.type === 'builtin') return `{{${segment.key}}}`;
    return `{{frontmatter[${JSON.stringify(segment.key)}]}}`;
  }).join('');
}

function singleLine(text: string): string {
  return text.replace(/\r\n|[\r\n\t\u2028\u2029]/g, ' ').replace(/\p{Cc}/gu, '');
}

export function propertyText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return singleLine(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
    return value.map(item => propertyText(item)).join(', ');
  }
  try { return singleLine(JSON.stringify(value) ?? ''); } catch { return ''; }
}

export function segmentValue(segment: Segment, context: TitleContext): string {
  if (segment.type === 'text') return segment.value;
  if (segment.type === 'builtin') return context[segment.key] ?? '';
  return context.frontmatter && Object.hasOwn(context.frontmatter, segment.key) ? propertyText(context.frontmatter[segment.key]) : '';
}

export function renderTitle(segments: readonly Segment[], context: TitleContext): string {
  const parts: string[] = [];
  for (const segment of segments) {
    const text = singleLine(segmentValue(segment, context));
    for (const character of text) {
      if (parts.length === MAX_TITLE_LENGTH) break;
      parts.push(character);
    }
    if (parts.length === MAX_TITLE_LENGTH) break;
  }
  // Document.title collapses ASCII whitespace. Match that representation for
  // previews and equality checks while retaining literals in the saved format.
  const title = parts.join('').replace(/ +/g, ' ').replace(/^ +| +$/g, '');
  const usable = title.trim() ? title : context.vault;
  return Array.from(usable).slice(0, MAX_TITLE_LENGTH).join('');
}

export function segmentName(segment: Segment): string {
  if (segment.type === 'text') return 'Text';
  if (segment.type === 'property') return segment.key;
  return ELEMENTS.find(element => element.key === segment.key)?.name ?? segment.key;
}
