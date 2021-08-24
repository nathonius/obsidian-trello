import { App, SuggestModal } from 'obsidian';
import { Subject } from 'rxjs';
import { TrelloList } from '../interfaces';

export class ListSuggestModal extends SuggestModal<TrelloList> {
  readonly selectedList = new Subject<TrelloList>();
  lists: TrelloList[] = [];

  constructor(app: App) {
    super(app);
  }

  getSuggestions(query: string): TrelloList[] {
    const term = query.toLowerCase();
    return this.lists.filter((list) => list.name.toLowerCase().includes(term));
  }

  renderSuggestion(value: TrelloList, el: HTMLElement): void {
    el.setText(value.name);
  }

  onChooseSuggestion(item: TrelloList): void {
    this.selectedList.next(item);
  }
}
