import { App } from 'obsidian';
import { AbortSuggestModal } from './abort-suggest-modal';

/** cardId is null for "all cards" */
export interface UnlinkOption {
  label: string;
  cardId: string | null;
}

export class UnlinkSuggestModal extends AbortSuggestModal<UnlinkOption> {
  constructor(app: App) {
    super(app);
    this.setInstructions([{ command: '', purpose: 'Select a card to unlink' }]);
  }

  getSuggestions(query: string): UnlinkOption[] {
    const term = query.toLowerCase();
    return this.options.filter((option) => option.label.toLowerCase().includes(term));
  }

  renderSuggestion(value: UnlinkOption, el: HTMLElement): void {
    el.setText(value.label);
  }
}
