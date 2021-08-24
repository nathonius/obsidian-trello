import { App, SuggestModal } from 'obsidian';
import { Subject } from 'rxjs';
import { NEW_TRELLO_CARD } from '../constants';
import { TrelloCard } from '../interfaces';

export class CardSuggestModal extends SuggestModal<TrelloCard> {
  readonly selectedCard = new Subject<TrelloCard>();
  cards: TrelloCard[] = [];

  constructor(app: App) {
    super(app);
  }

  getSuggestions(query: string): TrelloCard[] {
    const term = query.toLowerCase();
    return [NEW_TRELLO_CARD, ...this.cards.filter((card) => card.name.toLowerCase().includes(term))];
  }

  renderSuggestion(value: TrelloCard, el: HTMLElement): void {
    el.setText(value.name);
  }

  onChooseSuggestion(item: TrelloCard): void {
    this.selectedCard.next(item);
  }
}
