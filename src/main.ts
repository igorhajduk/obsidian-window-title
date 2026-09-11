import { Notice, Plugin, type WorkspaceContainer } from 'obsidian';
import { decodeSettings, SettingsStore } from './data';
import { FrontmatterIndex } from './frontmatter-index';
import { WindowTitleSettings } from './settings';
import { DEFAULT_TEMPLATE, parseTemplate, renderTitle, type Segment } from './template';
import { TitleController } from './title-controller';
import { contentContainers, readWindowContext } from './window-context';

export default class WindowTitlePlugin extends Plugin {
  template = DEFAULT_TEMPLATE;
  segments: Segment[] = parseTemplate(DEFAULT_TEMPLATE);
  loadError: string | null = null;
  saveError: string | null = null;
  pendingSaves = 0;
  index!: FrontmatterIndex;
  private store!: SettingsStore;
  private readonly controllers = new Map<WorkspaceContainer, TitleController>();
  private readonly subscribers = new Set<() => void>();
  private stopped = false;
  private reconcileQueued = false;
  private revision = 0;

  async onload(): Promise<void> {
    this.store = new SettingsStore(data => this.saveData(data));
    try {
      this.store.confirmed = decodeSettings(await this.loadData());
      this.template = this.store.confirmed.template;
      this.segments = parseTemplate(this.template);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
      new Notice(`${this.manifest.name} could not load its settings. Open its settings to reset them.`);
    }
    this.index = this.addChild(new FrontmatterIndex(this.app));
    this.addSettingTab(new WindowTitleSettings(this));
    const workspace = this.app.workspace;
    this.registerEvent(workspace.on('active-leaf-change', () => this.refresh()));
    this.registerEvent(workspace.on('file-open', () => this.refresh()));
    this.registerEvent(workspace.on('layout-change', () => this.reconcileSoon()));
    this.registerEvent(workspace.on('window-open', container => {
      if (!this.loadError && !this.stopped) this.attach(container);
      this.reconcileSoon();
    }));
    this.registerEvent(workspace.on('window-close', container => {
      this.controllers.get(container)?.dispose(false);
      this.controllers.delete(container);
      this.notify();
    }));
    this.registerEvent(this.app.vault.on('rename', () => this.refresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.refresh()));
    this.registerEvent(this.app.metadataCache.on('changed', file => {
      for (const [container, controller] of this.controllers) {
        if (readWindowContext(this.app, container).filepath === file.path) controller.refresh();
      }
      this.notify();
    }));
    workspace.onLayoutReady(() => { if (!this.stopped) this.reconcile(); });
  }

  private reconcileSoon(): void {
    if (this.reconcileQueued || this.stopped) return;
    this.reconcileQueued = true;
    queueMicrotask(() => { this.reconcileQueued = false; if (!this.stopped) this.reconcile(); });
  }

  private reconcile(): void {
    if (this.loadError || !this.app.workspace.layoutReady) return;
    const current = contentContainers(this.app);
    for (const [container, controller] of this.controllers) {
      const closed = !container.win || container.win.closed;
      const replacedRoot = container.doc === this.app.workspace.rootSplit.doc && !current.has(container);
      if (closed || replacedRoot) { controller.dispose(!closed); this.controllers.delete(container); }
    }
    for (const container of current) this.attach(container);
    this.refresh();
  }

  private attach(container: WorkspaceContainer): void {
    if (!container.doc || container.win.closed || this.controllers.has(container)) return;
    this.controllers.set(container, new TitleController(container.doc, () => renderTitle(this.segments, readWindowContext(this.app, container)), () => {
      new Notice(`${this.manifest.name} paused in a window because another source keeps replacing its title. Disable other title overrides, then re-enable this plugin.`);
    }));
  }

  private refresh(): void {
    if (this.stopped || this.loadError) return;
    for (const controller of this.controllers.values()) controller.refresh();
    this.notify();
  }

  subscribe(callback: () => void): () => void { this.subscribers.add(callback); return () => this.subscribers.delete(callback); }
  private notify(): void { for (const subscriber of this.subscribers) subscriber(); }

  setTemplate(template: string): void {
    const segments = parseTemplate(template);
    this.template = template;
    this.segments = segments;
    this.pendingSaves++;
    const revision = ++this.revision;
    this.saveError = null;
    this.refresh();
    void this.store.save(template).catch((error: unknown) => {
      if (revision === this.revision) this.saveError = error instanceof Error ? error.message : String(error);
    }).finally(() => { this.pendingSaves--; if (!this.stopped) this.notify(); });
  }

  resetSettings(): void {
    this.loadError = null;
    this.setTemplate(DEFAULT_TEMPLATE);
    this.reconcile();
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.store.settle();
    if (this.stopped) return;
    const revision = this.revision;
    try {
      const incoming = decodeSettings(await this.loadData());
      if (this.stopped || revision !== this.revision) return;
      this.store.confirmed = incoming;
      this.template = incoming.template;
      this.segments = parseTemplate(this.template);
      this.saveError = null;
      this.loadError = null;
      this.reconcile();
    } catch (error) {
      if (this.stopped || revision !== this.revision) return;
      this.saveError = `External settings were not loaded: ${error instanceof Error ? error.message : String(error)}`;
      this.notify();
    }
  }

  onunload(): void {
    this.stopped = true;
    for (const controller of this.controllers.values()) controller.dispose();
    this.controllers.clear();
    this.subscribers.clear();
  }
}
