import { DEFAULT_TEMPLATE, parseTemplate } from './template';

export interface SettingsData { version: 1; template: string }

export function decodeSettings(value: unknown): SettingsData {
  if (value === null || value === undefined) return { version: 1, template: DEFAULT_TEMPLATE };
  if (typeof value !== 'object') throw new Error('The saved settings are not a valid object.');
  const data = value as Record<string, unknown>;
  if (data.version !== 1) throw new Error('The saved settings version is not supported.');
  if (typeof data.template !== 'string') throw new Error('The saved template is missing.');
  parseTemplate(data.template);
  return { version: 1, template: data.template };
}

export class SettingsStore {
  confirmed: SettingsData = { version: 1, template: DEFAULT_TEMPLATE };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly write: (data: SettingsData) => Promise<void>) {}

  save(template: string): Promise<void> {
    parseTemplate(template);
    const data: SettingsData = { version: 1, template };
    const next = this.queue.then(async () => {
      await this.write(data);
      this.confirmed = data;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async settle(): Promise<void> { await this.queue; }
}
