/** Owns only a document title; it never owns or changes a workspace window. */
export class TitleController {
  private baseline: string;
  private lastWrite: string | null = null;
  private observer: MutationObserver;
  private disposed = false;
  private scheduled = false;
  private suspended = false;
  private burstStart = 0;
  private burstCount = 0;

  constructor(
    private readonly doc: Document,
    private readonly format: () => string,
    private readonly onConflict: () => void,
    createObserver: (callback: MutationCallback) => MutationObserver = callback => new MutationObserver(callback),
  ) {
    this.baseline = doc.title;
    this.observer = createObserver(records => {
      if (this.disposed || !records.length) return;
      this.captureExternal();
      this.refresh();
    });
    const title = doc.head.querySelector('title') ?? doc.head.createEl('title');
    this.observer.observe(title, { subtree: true, childList: true, characterData: true });
    this.refresh();
  }

  private captureExternal(): void {
    this.baseline = this.doc.title;
    const now = Date.now();
    if (now - this.burstStart > 250) { this.burstStart = now; this.burstCount = 0; }
    if (++this.burstCount > 24 && !this.suspended) {
      this.suspended = true;
      this.onConflict();
    }
  }

  refresh(): void {
    if (this.disposed || this.scheduled || this.suspended) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.disposed || this.suspended) return;
      if (this.observer.takeRecords().length) this.captureExternal();
      if (this.suspended) return;
      const title = this.format();
      if (this.doc.title !== title) {
        this.doc.title = title;
        this.lastWrite = title;
        // DOM title writes are synchronous. Discard precisely the records from
        // this write, leaving later core writes observable even if text matches.
        this.observer.takeRecords();
      }
    });
  }

  dispose(restore = true): void {
    if (this.disposed) return;
    if (this.observer.takeRecords().length) this.baseline = this.doc.title;
    this.disposed = true;
    this.observer.disconnect();
    if (restore && !this.suspended && this.lastWrite !== null && this.doc.title === this.lastWrite) this.doc.title = this.baseline;
  }
}
