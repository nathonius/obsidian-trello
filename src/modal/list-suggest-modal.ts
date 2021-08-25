import { TrelloList } from '../interfaces';
import { AbortSuggestModal } from './abort-suggest-modal';

export class ListSuggestModal extends AbortSuggestModal<TrelloList> {
  getSuggestions(query: string): TrelloList[] {
    const term = query.toLowerCase();
    return this.options.filter((list) => list.name.toLowerCase().includes(term));
  }

  renderSuggestion(value: TrelloList, el: HTMLElement): void {
    el.setText(value.name);
  }
}
