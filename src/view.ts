import { ItemView, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import { combineLatest, forkJoin, of, Subject } from 'rxjs';
import { finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { CUSTOM_ICONS, TRELLO_VIEW_TYPE } from './constants';
import { TrelloAction, TrelloCard } from './interfaces';
import { TrelloPlugin } from './plugin';

/**
 * TODO:
 * - Add empty state w/ button to connect trello card
 *  - Should just call the command ideally.
 *  - Maybe if no token is set, show button to do that instead
 */

export class TrelloView extends ItemView {
  private bypassCache = false;
  private readonly destroy = new Subject<void>();
  private readonly update = new Subject<void>();
  constructor(private readonly plugin: TrelloPlugin, leaf: WorkspaceLeaf) {
    super(leaf);
    combineLatest([this.plugin.currentCard, this.update])
      .pipe(
        takeUntil(this.destroy),
        switchMap(([card, _]) =>
          forkJoin([
            of(card),
            card
              ? this.plugin.api.getActionsFromCard(
                  card.id,
                  undefined,
                  this.bypassCache
                )
              : of(null)
          ])
        ),
        finalize(() => {
          this.bypassCache = false;
        })
      )
      .subscribe(([card, actions]) => {
        this.contentEl.empty();
        if (!card) {
          this.renderEmptyView();
        } else {
          this.renderConnectedView(card, actions);
        }
      });
    this.update.next();
  }

  getDisplayText(): string {
    return 'Trello';
  }

  getViewType(): string {
    return TRELLO_VIEW_TYPE;
  }

  getIcon() {
    return CUSTOM_ICONS.trello.id;
  }

  onunload() {
    this.destroy.next();
    this.destroy.complete();
  }

  private renderEmptyView() {
    this.contentEl.createEl('h2', { text: 'No Trello card connected.' });
    const connectButton = this.contentEl.createEl('button', {
      text: 'Connect Trello Card',
      attr: { type: 'button' }
    });
    connectButton.addEventListener('click', () => {
      this.plugin.connectTrelloCard();
    });
  }

  private renderConnectedView(
    card: TrelloCard,
    actions: TrelloAction[] | null
  ): void {
    this.renderHeader(this.contentEl);
    this.renderCardInfo(card, this.contentEl);
    this.renderCommentSection(card, actions, this.contentEl);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv('nav-header');
    const buttons = header.createDiv('nav-buttons-container');
    this.renderNavButton(buttons, 'Refresh card', 'reset', () => {
      this.bypassCache = true;
      this.update.next();
    });
    this.renderNavButton(buttons, 'Link another card', 'link', () => {
      this.plugin.connectTrelloCard();
    });
    this.renderNavButton(buttons, 'Unlink card', 'trash', () => {
      this.plugin.disconnectTrelloCard();
    });
  }

  private renderCardInfo(card: TrelloCard, container: HTMLElement): void {
    container.createEl('h2', { text: card.name });
    container.createEl('span', { text: card.dateLastActivity });
    container.createEl('span', { text: card.desc });
  }

  private renderCommentSection(
    card: TrelloCard,
    comments: TrelloAction[] | null,
    container: HTMLElement
  ): void {
    container.createEl('h3', { text: 'Comments' });
    if (comments && comments.length !== 0) {
      comments.forEach((a) => {
        this.renderComment(a, container);
      });
    }
    const inputContainer = container.createDiv(
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
            this.bypassCache = true;
            this.update.next();
            new Notice('Added comment.');
          });
      }
    });
  }

  private renderComment(comment: TrelloAction, container: HTMLElement): void {
    const commentContainer = container.createDiv('trello-comment');
    commentContainer.createEl('p', { text: comment.data.text });
  }

  private renderNavButton(
    container: HTMLElement,
    label: string,
    icon: string,
    callback: () => any
  ) {
    const button = container.createDiv({
      cls: 'nav-action-button',
      attr: { 'aria-label': label }
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
  }
}
