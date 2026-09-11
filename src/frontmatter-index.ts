import { Component, TFile, type App, type CachedMetadata } from 'obsidian';
import { PropertyNames } from './property-names';

export class FrontmatterIndex extends Component {
  private readonly names = new PropertyNames();
  private started = false;
  private stopped = false;
  private loading: Promise<void> | null = null;

  constructor(private readonly app: App) { super(); }

  onload(): void {
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => this.update(file, cache)));
    this.registerEvent(this.app.metadataCache.on('deleted', file => this.names.remove(file.path)));
    this.registerEvent(this.app.vault.on('delete', file => this.names.remove(file.path)));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.names.remove(oldPath);
      if (file instanceof TFile) this.update(file, this.app.metadataCache.getFileCache(file));
    }));
  }

  private update(file: TFile, cache: CachedMetadata | null): void {
    if (!this.started || this.stopped) return;
    this.names.replace(file.path, Object.keys(cache?.frontmatter ?? {}));
  }

  async available(): Promise<string[]> {
    if (this.stopped) return [];
    if (!this.started) {
      this.started = true;
      this.loading = this.build();
    }
    await this.loading;
    return this.names.names();
  }

  private async build(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (let i = 0; i < files.length && !this.stopped; i++) {
      const file = files[i];
      if (this.app.vault.getAbstractFileByPath(file.path) === file) this.update(file, this.app.metadataCache.getFileCache(file));
      if (i % 100 === 99) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
  }

  onunload(): void { this.stopped = true; this.names.clear(); }
}
