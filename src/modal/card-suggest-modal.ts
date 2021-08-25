import { NEW_TRELLO_CARD } from '../constants';
import { TrelloCard } from '../interfaces';
import { AbortSuggestModal } from './abort-suggest-modal';

export class CardSuggestModal extends AbortSuggestModal<TrelloCard> {
  getSuggestions(query: string): TrelloCard[] {
    const term = query.toLowerCase();
    return [NEW_TRELLO_CARD, ...this.options.filter((card) => card.name.toLowerCase().includes(term))];
  }

  renderSuggestion(value: TrelloCard, el: HTMLElement): void {
    el.setText(value.name);
  }
}
