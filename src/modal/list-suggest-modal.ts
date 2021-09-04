import { App } from 'obsidian';
import { TrelloList } from '../interfaces';
import { AbortSuggestModal } from './abort-suggest-modal';

export class ListSuggestModal extends AbortSuggestModal<TrelloList> {
  constructor(app: App) {
    super(app);
    this.setInstructions([{ command: '', purpose: 'Select a Trello list' }]);
  }

  getSuggestions(query: string): TrelloList[] {
    const term = query.toLowerCase();
    return this.options.filter((list) => list.name.toLowerCase().includes(term));
  }

  renderSuggestion(value: TrelloList, el: HTMLElement): void {
    el.setText(value.name);
  }
}
