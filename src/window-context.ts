import { FileView, TFile, type App, type WorkspaceContainer } from 'obsidian';
import type { TitleContext } from './template';

export function readWindowContext(app: App, container: WorkspaceContainer): TitleContext {
  const leaf = app.workspace.getMostRecentLeaf(container);
  const context: TitleContext = { vault: app.vault.getName(), title: leaf?.getDisplayText() ?? '' };
  if (!leaf) return context;
  let file: TFile | null = leaf.view instanceof FileView ? leaf.view.file : null;
  if (!file && leaf.isDeferred) {
    const state = leaf.getViewState().state;
    const path = typeof state?.file === 'string' ? state.file : null;
    const candidate = path ? app.vault.getAbstractFileByPath(path) : null;
    if (candidate instanceof TFile) file = candidate;
  }
  if (file) {
    context.filename = file.name;
    context.basename = file.basename;
    context.filepath = file.path;
    context.folder = file.parent?.path === '/' ? '' : file.parent?.path ?? '';
    context.frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  }
  return context;
}

export function contentContainers(app: App): Set<WorkspaceContainer> {
  const containers = new Set<WorkspaceContainer>([app.workspace.rootSplit]);
  app.workspace.iterateAllLeaves(leaf => { containers.add(leaf.getContainer()); });
  return containers;
}
