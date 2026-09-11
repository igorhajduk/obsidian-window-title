import { SuggestModal, prepareFuzzySearch, type App } from 'obsidian';
import { ELEMENTS, segmentValue, type Segment, type TitleContext } from './template';
import type { FrontmatterIndex } from './frontmatter-index';

interface Choice { name: string; description: string; segment: Segment }

export class ElementPicker extends SuggestModal<Choice> {
  private closed = false;
  constructor(
    app: App,
    private readonly index: FrontmatterIndex,
    private readonly context: () => TitleContext,
    private readonly choose: (segment: Segment) => void,
    private readonly didClose: () => void,
  ) {
    super(app);
    this.setPlaceholder('Search elements and frontmatter properties…');
    this.setInstructions([{ command: '↑↓', purpose: 'Navigate' }, { command: '↵', purpose: 'Insert element' }, { command: 'esc', purpose: 'Cancel' }]);
    this.emptyStateText = 'No matching elements or properties.';
    this.limit = 100;
  }

  async getSuggestions(query: string): Promise<Choice[]> {
    const keys = await this.index.available();
    if (this.closed) return [];
    const choices: Choice[] = [
      ...ELEMENTS.map(element => ({ name: element.name, description: element.description, segment: { type: 'builtin' as const, key: element.key } })),
      { name: 'Text', description: 'Fixed text, spaces, or a separator.', segment: { type: 'text', value: ' — ' } },
      ...keys.map(key => ({ name: key, description: 'Frontmatter property', segment: { type: 'property' as const, key } })),
    ];
    if (!query.trim()) return choices;
    const search = prepareFuzzySearch(query);
    return choices.map(choice => ({ choice, score: search(choice.name)?.score ?? null }))
      .filter((item): item is { choice: Choice; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score).map(item => item.choice);
  }

  renderSuggestion(choice: Choice, el: HTMLElement): void {
    el.createDiv({ cls: 'window-title-choice-name', text: choice.name });
    const value = segmentValue(choice.segment, this.context());
    el.createDiv({ cls: 'window-title-choice-description', text: `${choice.description}${choice.segment.type === 'text' ? '' : ` · ${value ? value.slice(0, 160) : 'Empty in this tab'}`}` });
  }

  onChooseSuggestion(choice: Choice): void { this.choose({ ...choice.segment }); }
  onClose(): void { this.closed = true; this.didClose(); }
}
