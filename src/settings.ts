import { Component, PluginSettingTab, Setting, View, type SettingDefinitionItem, type WorkspaceContainer } from 'obsidian';
import type WindowTitlePlugin from './main';
import { ElementPicker } from './element-picker';
import { parseTemplate, renderTitle, segmentName, segmentValue, serializeSegments, type Segment } from './template';
import { contentContainers, readWindowContext } from './window-context';

export class WindowTitleSettings extends PluginSettingTab {
  private editor: TitleEditor | null = null;
  constructor(private readonly plugin: WindowTitlePlugin) { super(plugin.app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [{
      name: 'Title format',
      desc: 'Compose the title with vault, tab, path, and frontmatter elements.',
      aliases: ['Window title', 'Template', 'Visual builder', 'Frontmatter', 'File name', 'Vault name'],
      render: setting => {
        this.closeEditor();
        setting.settingEl.empty();
        setting.settingEl.addClass('window-title-settings');
        this.editor = this.plugin.addChild(new TitleEditor(this.plugin, setting.settingEl, () => this.closeEditor()));
        return () => this.closeEditor();
      },
    }];
  }

  private closeEditor(): void {
    if (this.editor) { this.plugin.removeChild(this.editor); this.editor = null; }
  }
}

class TitleEditor extends Component {
  private segments: Segment[];
  private lastApplied: string;
  private target: WorkspaceContainer;
  private templateEl!: HTMLTextAreaElement;
  private builderEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private errorEl!: HTMLElement;
  private previewSourceEl!: HTMLElement;
  private addButton!: HTMLButtonElement;
  private discardButton!: HTMLButtonElement;
  private disposed = false;
  private invalidDraft = false;
  private externalPending = false;
  private composing = false;
  private dragged: number | null = null;
  private dragFrame: number | null = null;
  private picker: ElementPicker | null = null;

  constructor(private readonly plugin: WindowTitlePlugin, private readonly root: HTMLElement, private readonly close: () => void) {
    super();
    this.lastApplied = plugin.template;
    this.segments = parseTemplate(plugin.template);
    this.target = plugin.app.workspace.getActiveViewOfType(View)?.leaf.getContainer() ?? plugin.app.workspace.rootSplit;
  }

  onload(): void {
    if (this.plugin.loadError) {
      this.root.createEl('p', { text: `The saved settings could not be loaded: ${this.plugin.loadError}` });
      new Setting(this.root).setName('Reset saved format').setDesc('Replace the invalid settings with the default vault-first format.').addButton(button => {
        button.setButtonText('Reset settings').setDestructive().onClick(() => { this.plugin.resetSettings(); this.root.empty(); this.build(); });
      });
    } else this.build();
    this.register(this.plugin.subscribe(() => this.changed()));
    this.registerDomEvent(this.root.win, 'pagehide', this.close);
  }

  private build(): void {
    this.root.createEl('p', { cls: 'window-title-intro', text: 'One format for this vault. Each window uses its own selected tab.' });
    const preview = this.root.createDiv('window-title-preview');
    preview.createDiv({ cls: 'window-title-label', text: 'Preview' });
    this.previewEl = preview.createDiv('window-title-preview-value');
    this.previewSourceEl = preview.createDiv('window-title-preview-source');
    new Setting(this.root).setName('Visual builder').setDesc('Arrange elements in title order. Add text for spaces and separators.').addButton(button => {
      this.addButton = button.buttonEl;
      button.setButtonText('Add element').setCta().onClick(() => this.openPicker(segment => {
        this.segments.push(segment); this.commitBuilder(); this.renderBuilder(); this.focusRow(this.segments.length - 1);
      }));
    });
    this.builderEl = this.root.createDiv('window-title-segments');
    this.builderEl.setAttribute('aria-label', 'Title elements');
    this.registerDomEvent(this.builderEl, 'dragover', event => {
      if (this.dragged === null || this.invalidDraft) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.showDropTarget(event.clientY);
    });
    this.registerDomEvent(this.builderEl, 'dragleave', event => {
      if (!this.builderEl.contains(event.relatedTarget as Node | null)) this.clearDropTarget();
    });
    this.registerDomEvent(this.builderEl, 'drop', event => {
      if (this.dragged === null || this.invalidDraft) return;
      event.preventDefault();
      const from = this.dragged;
      const slot = this.dropSlot(event.clientY);
      this.endDrag();
      this.move(from, slot > from ? slot - 1 : slot);
    });
    this.registerDomEvent(this.root.doc, 'dragend', () => this.endDrag());
    new Setting(this.root).setName('Template').setDesc('Edits here update the builder. Text outside {{elements}} is displayed literally.').addTextArea(text => {
      this.templateEl = text.inputEl;
      this.templateEl.rows = 3;
      this.templateEl.spellcheck = false;
      this.templateEl.setAttribute('aria-label', 'Window title template');
      text.setValue(this.plugin.template).onChange(() => { if (!this.composing) this.editTemplate(); });
    }).settingEl.addClass('window-title-template-setting');
    this.registerDomEvent(this.templateEl, 'compositionstart', () => this.composing = true);
    this.registerDomEvent(this.templateEl, 'compositionend', () => { this.composing = false; this.editTemplate(); });
    new Setting(this.root).setName('Insert into template').setDesc('Insert an element at the insertion point, or replace the selected text.').addButton(button => {
      button.setButtonText('Insert element').onClick(() => {
        const start = this.templateEl.selectionStart;
        const end = this.templateEl.selectionEnd;
        this.openPicker(segment => {
          this.templateEl.setRangeText(serializeSegments([segment]), start, end, 'end');
          this.editTemplate();
          this.templateEl.focus();
        });
      });
    });
    this.errorEl = this.root.createDiv('window-title-error');
    this.errorEl.setAttribute('role', 'status');
    this.statusEl = this.root.createDiv('window-title-save-status');
    this.statusEl.setAttribute('role', 'status');
    new Setting(this.root).setName('Discard unfinished edit').addButton(button => {
      this.discardButton = button.buttonEl;
      button.setButtonText('Use last valid format').onClick(() => {
        this.templateEl.value = this.plugin.template;
        this.lastApplied = this.plugin.template;
        this.segments = parseTemplate(this.plugin.template);
        this.invalidDraft = false; this.externalPending = false;
        this.renderBuilder(); this.updatePreview();
      });
    }).settingEl.addClass('window-title-discard-setting');
    const help = this.root.createEl('details', { cls: 'window-title-help' });
    help.createEl('summary', { text: 'Template elements and empty values' });
    help.createEl('p', { text: 'Available elements: {{vault}}, {{title}}, {{filename}}, {{basename}}, {{folder}}, {{filepath}}, and {{frontmatter["property name"]}}. Use a backslash before a brace or backslash to display it literally.' });
    help.createEl('p', { text: 'Missing file or property values are empty; separators stay in place. The window title collapses repeated spaces and trims surrounding spaces. Lists use commas. Structured values use compact JSON. An entirely empty title falls back to the vault name. Conditions and expressions are not supported.' });
    this.renderBuilder(); this.updatePreview();
  }

  private editTemplate(): void {
    const value = this.templateEl.value;
    try {
      const segments = parseTemplate(value);
      this.invalidDraft = false; this.externalPending = false;
      this.segments = segments;
      this.lastApplied = value;
      this.plugin.setTemplate(value);
      this.renderBuilder();
    } catch (error) {
      this.invalidDraft = true;
      this.errorEl.setText(`${error instanceof Error ? error.message : String(error)} The builder and window titles keep the last valid format.`);
      this.renderBuilder();
    }
    this.updatePreview();
  }

  private commitBuilder(): void {
    if (this.invalidDraft || this.disposed) return;
    const template = serializeSegments(this.segments);
    try { parseTemplate(template); } catch (error) {
      this.errorEl.setText(error instanceof Error ? error.message : String(error));
      return;
    }
    this.lastApplied = template;
    this.templateEl.value = template;
    this.plugin.setTemplate(template);
    this.updatePreview();
  }

  private openPicker(choose: (segment: Segment) => void): void {
    this.picker?.close();
    this.picker = new ElementPicker(this.plugin.app, this.plugin.index, () => this.context(), segment => {
      if (!this.disposed) choose(segment);
    }, () => this.picker = null);
    this.picker.open();
  }

  private renderBuilder(): void {
    this.endDrag();
    this.builderEl.empty();
    if (!this.segments.length) this.builderEl.createEl('p', { cls: 'window-title-empty', text: 'No elements. The title will use the vault name.' });
    this.segments.forEach((segment, index) => {
      const row = new Setting(this.builderEl).setName(segmentName(segment));
      row.settingEl.addClass('window-title-segment');
      row.settingEl.dataset.segmentIndex = String(index);
      row.settingEl.dataset.segmentType = segment.type;
      row.addExtraButton(button => {
        button.setIcon('grip-vertical').setTooltip('Drag to reorder').setDisabled(this.invalidDraft);
        button.extraSettingsEl.draggable = !this.invalidDraft;
        button.extraSettingsEl.addEventListener('dragstart', event => {
          if (this.invalidDraft) { event.preventDefault(); return; }
          this.endDrag();
          this.dragged = index;
          event.dataTransfer?.setData('text/plain', String(index));
          const tile = row.settingEl;
          const bounds = tile.getBoundingClientRect();
          tile.addClass('is-drag-preview');
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setDragImage(tile, Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)), Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)));
          }
          // Let the browser capture the raised tile before fading its source.
          this.dragFrame = this.root.win.requestAnimationFrame(() => {
            this.dragFrame = null;
            tile.removeClass('is-drag-preview');
            if (this.dragged === index) tile.addClass('is-dragging');
          });
        });
      });
      if (segment.type === 'text') row.addText(text => {
        text.setValue(segment.value).setPlaceholder('Text or separator').setDisabled(this.invalidDraft).onChange(value => {
          segment.value = value; this.commitBuilder();
        });
        text.inputEl.setAttribute('aria-label', `Text element ${index + 1}`);
      });
      else {
        row.setDesc(segment.type === 'property' ? 'Frontmatter property' : serializeSegments([segment]));
        row.addButton(button => button.setButtonText('Change').setDisabled(this.invalidDraft).onClick(() => this.openPicker(selected => {
          this.segments[index] = selected; this.commitBuilder(); this.renderBuilder(); this.focusRow(index);
        })));
      }
      row.addExtraButton(button => button.setIcon('arrow-up').setTooltip('Move earlier').setDisabled(this.invalidDraft || index === 0).onClick(() => this.move(index, index - 1)));
      row.addExtraButton(button => button.setIcon('arrow-down').setTooltip('Move later').setDisabled(this.invalidDraft || index === this.segments.length - 1).onClick(() => this.move(index, index + 1)));
      row.addExtraButton(button => button.setIcon('x').setTooltip('Remove element').setDisabled(this.invalidDraft).onClick(() => {
        this.segments.splice(index, 1); this.commitBuilder(); this.renderBuilder(); this.focusRow(Math.min(index, this.segments.length - 1));
      }));
    });
  }

  private dropSlot(y: number): number {
    const rows = Array.from(this.builderEl.querySelectorAll<HTMLElement>('[data-segment-index]'));
    const slot = rows.findIndex(row => {
      const bounds = row.getBoundingClientRect();
      return y < bounds.top + bounds.height / 2;
    });
    return slot === -1 ? rows.length : slot;
  }

  private clearDropTarget(): void {
    this.builderEl.querySelectorAll('.is-drop-before, .is-drop-after').forEach(row => row.removeClass('is-drop-before', 'is-drop-after'));
  }

  private showDropTarget(y: number): void {
    this.clearDropTarget();
    if (this.dragged === null) return;
    const slot = this.dropSlot(y);
    if ((slot > this.dragged ? slot - 1 : slot) === this.dragged) return;
    const rows = this.builderEl.querySelectorAll('[data-segment-index]');
    if (slot === rows.length) rows[slot - 1]?.addClass('is-drop-after');
    else rows[slot]?.addClass('is-drop-before');
  }

  private endDrag(): void {
    if (this.dragFrame !== null) this.root.win.cancelAnimationFrame(this.dragFrame);
    this.dragFrame = null;
    this.dragged = null;
    if (!this.builderEl) return;
    this.clearDropTarget();
    this.builderEl.querySelectorAll('.is-dragging, .is-drag-preview').forEach(row => row.removeClass('is-dragging', 'is-drag-preview'));
  }

  private move(from: number, to: number): void {
    if (this.invalidDraft || from === to || to < 0 || to >= this.segments.length) return;
    this.segments.splice(to, 0, this.segments.splice(from, 1)[0]);
    this.commitBuilder(); this.renderBuilder(); this.focusRow(to);
  }

  private focusRow(index: number): void {
    this.builderEl.querySelector<HTMLElement>(`[data-segment-index="${index}"] input, [data-segment-index="${index}"] button`)?.focus();
  }

  private context() {
    if (!contentContainers(this.plugin.app).has(this.target)) this.target = this.plugin.app.workspace.rootSplit;
    return readWindowContext(this.plugin.app, this.target);
  }

  private changed(): void {
    if (this.disposed || !this.templateEl) return;
    if (this.plugin.template !== this.lastApplied) {
      if (this.invalidDraft || this.composing) this.externalPending = true;
      else {
        this.lastApplied = this.plugin.template;
        this.templateEl.value = this.lastApplied;
        this.segments = parseTemplate(this.lastApplied);
        this.renderBuilder();
      }
    }
    this.updatePreview();
  }

  private updatePreview(): void {
    if (!this.previewEl || this.disposed) return;
    const context = this.context();
    this.previewEl.setText(renderTitle(this.plugin.segments, context));
    const empty = this.plugin.segments.filter(segment => segment.type !== 'text' && !segmentValue(segment, context)).map(segment => segmentName(segment));
    this.previewSourceEl.setText(`${context.filepath ?? context.title}${empty.length ? ` · Empty: ${[...new Set(empty)].join(', ')}` : ''}`);
    if (!this.invalidDraft) this.errorEl.setText('');
    if (this.externalPending) this.errorEl.setText('Settings changed outside this editor. Your unfinished text is preserved. Use the last valid format or finish this edit to replace it.');
    this.addButton.disabled = this.invalidDraft;
    this.discardButton.closest('.setting-item')?.toggleClass('is-visible', this.invalidDraft || this.externalPending);
    this.statusEl.setText(this.plugin.saveError ? `Not saved: ${this.plugin.saveError} Edit again to retry.` : this.plugin.pendingSaves ? 'Saving…' : this.invalidDraft ? 'Unfinished edit is not saved.' : 'Saved for this vault.');
  }

  onunload(): void { this.disposed = true; this.endDrag(); this.picker?.close(); this.picker = null; }
}
