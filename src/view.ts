import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Observable, Subject, takeUntil } from 'rxjs';
import { TRELLO_VIEW_TYPE } from './constants';
import { TrelloCard } from './interfaces';
import { TrelloPlugin } from './plugin';

export class TrelloView extends ItemView {
  private readonly destroy = new Subject<void>();
  constructor(private readonly plugin: TrelloPlugin, leaf: WorkspaceLeaf) {
    super(leaf);
    this.plugin.currentCard.pipe(takeUntil(this.destroy)).subscribe((card) => {
      this.contentEl.empty();
      if (!card) {
        this.contentEl.createDiv({ text: 'no card' });
        return;
      }
      this.contentEl.createEl('h2', { text: card.name });
      this.contentEl.createEl('span', { text: card.dateLastActivity });
      this.contentEl.createEl('span', { text: card.desc });
    });
  }

  getDisplayText(): string {
    return 'Trello';
  }

  getViewType(): string {
    return TRELLO_VIEW_TYPE;
  }

  onunload() {
    this.destroy.next();
    this.destroy.complete();
  }
}
