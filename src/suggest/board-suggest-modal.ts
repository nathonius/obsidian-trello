import { App, SuggestModal } from 'obsidian';
import { Subject } from 'rxjs';
import { TrelloBoard } from '../interfaces';

export class BoardSuggestModal extends SuggestModal<TrelloBoard> {
  readonly selectedBoard = new Subject<TrelloBoard>();
  boards: TrelloBoard[] = [];

  constructor(app: App) {
    super(app);
  }

  getSuggestions(query: string): TrelloBoard[] {
    const term = query.toLowerCase();
    return this.boards.filter((board) =>
      board.name.toLowerCase().includes(term)
    );
  }

  renderSuggestion(value: TrelloBoard, el: HTMLElement): void {
    el.setText(value.name);
  }

  onChooseSuggestion(item: TrelloBoard): void {
    this.selectedBoard.next(item);
  }
}
