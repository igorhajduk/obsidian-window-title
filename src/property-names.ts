export class PropertyNames {
  private readonly files = new Map<string, Set<string>>();
  private readonly counts = new Map<string, number>();

  replace(path: string, keys: Iterable<string>): void {
    this.remove(path);
    const names = new Set(keys);
    if (!names.size) return;
    this.files.set(path, names);
    for (const key of names) this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  remove(path: string): void {
    for (const key of this.files.get(path) ?? []) {
      const count = (this.counts.get(key) ?? 1) - 1;
      if (count) this.counts.set(key, count); else this.counts.delete(key);
    }
    this.files.delete(path);
  }

  names(): string[] { return [...this.counts.keys()].sort((a, b) => a.localeCompare(b)); }
  clear(): void { this.files.clear(); this.counts.clear(); }
}
