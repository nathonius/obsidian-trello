import { TrelloBoard } from '../interfaces';
import { AbortSuggestModal } from './abort-suggest-modal';

export class BoardSuggestModal extends AbortSuggestModal<TrelloBoard> {
  getSuggestions(query: string): TrelloBoard[] {
    const term = query.toLowerCase();
    return this.options.filter((board) => board.name.toLowerCase().includes(term));
  }

  renderSuggestion(value: TrelloBoard, el: HTMLElement): void {
    el.setText(value.name);
  }
}
