import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { concat, forkJoin, Observable, of, Subject } from 'rxjs';
import { concatMap, switchMap, takeUntil, tap } from 'rxjs/operators';
import { TRELLO_VIEW_TYPE } from './constants';
import { TrelloCard } from './interfaces';
import { TrelloPlugin } from './plugin';

/**
 * TODO:
 * - Add empty state w/ button to connect trello card
 *  - Should just call the command ideally.
 *  - Maybe if no token is set, show button to do that instead
 */

export class TrelloView extends ItemView {
  private readonly destroy = new Subject<void>();
  constructor(private readonly plugin: TrelloPlugin, leaf: WorkspaceLeaf) {
    super(leaf);
    this.plugin.currentCard
      .pipe(
        takeUntil(this.destroy),
        switchMap((card) =>
          forkJoin([
            of(card),
            card ? this.plugin.api.getActionsFromCard(card.id) : of(null)
          ])
        )
      )
      .subscribe(([card, actions]) => {
        this.contentEl.empty();
        if (!card) {
          this.contentEl.createDiv({ text: 'no card' });
          return;
        }
        this.contentEl.createEl('h2', { text: card.name });
        this.contentEl.createEl('span', { text: card.dateLastActivity });
        this.contentEl.createEl('span', { text: card.desc });

        this.contentEl.createEl('h3', { text: 'Comments' });
        if (actions && actions.length !== 0) {
          actions.forEach((a) => {
            const commentContainer = this.contentEl.createDiv('trello-comment');
            commentContainer.createEl('p', { text: a.data.text });
          });
        }
        const inputContainer = this.contentEl.createDiv(
          'trello-comment-input-container'
        );
        const input = inputContainer.createEl('input', {
          attr: { type: 'text' }
        });
        const button = inputContainer.createEl('button', {
          text: 'Submit',
          attr: { type: 'button' }
        });
        button.addEventListener('click', () => {
          if (input.value) {
            this.plugin.api
              .addCommentToCard(card.id, input.value)
              .pipe(
                tap(() => {
                  input.value = '';
                })
              )
              .subscribe(() => {
                new Notice('Added comment.');
              });
          }
        });
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
