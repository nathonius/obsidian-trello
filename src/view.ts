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

  private renderPaneContainer(): HTMLDivElement {
    return this.contentEl.createDiv('trello-pane--container');
  }

  private renderEmptyView() {
    const pane = this.renderPaneContainer();
    pane.createEl('h2', { text: 'No Trello card connected.' });
    const connectButton = pane.createEl('button', {
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
    const pane = this.renderPaneContainer();
    const cardInfo = pane.createDiv('trello-pane--card-info');
    this.renderCardInfo(card, cardInfo);
    if (card.labels && card.labels.length > 0) {
      const labelSectionContainer = pane.createDiv(
        'trello-pane--labels-section'
      );
      // TODO: Render labels
    }
    const commentSectionContainer = pane.createDiv(
      'trello-pane--comment-section'
    );
    this.renderCommentSection(card, actions, commentSectionContainer);
  }

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv('nav-header');
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

  private renderCardInfo(card: TrelloCard, parent: HTMLElement): void {
    parent.createEl('h3', { text: card.name });
    parent.createEl('span', { text: card.desc });
  }

  private renderCommentSection(
    card: TrelloCard,
    comments: TrelloAction[] | null,
    parent: HTMLElement
  ): void {
    const container = parent.createDiv('trello-comment-input--container');

    // Small hack for auto-resizing textarea
    // See: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
    const inputContainer = container.createDiv({
      cls: 'trello-comment-input--input-container'
    });
    const input = inputContainer.createEl('textarea', {
      cls: 'trello-comment-input--input',
      attr: {
        onInput: 'this.parentNode.dataset.replicatedValue = this.value',
        placeholder: 'Write a comment...'
      }
    });
    const button = container.createEl('button', {
      cls: 'trello-comment-input--submit',
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
    if (comments && comments.length !== 0) {
      comments.forEach((a) => {
        this.renderComment(a, parent);
      });
    }
  }

  private renderComment(comment: TrelloAction, parent: HTMLElement): void {
    const commentContainer = parent.createDiv('trello-comment--container');
    const commentMetadata = commentContainer.createDiv(
      'trello-comment--metadata'
    );
    commentMetadata.createSpan({
      text: comment.memberCreator.fullName,
      cls: 'trello-comment--creator'
    });
    commentMetadata.createSpan({
      text: new Date(comment.date).toLocaleString(),
      cls: 'trello-comment--date'
    });
    const textContainer = commentContainer.createDiv(
      'trello-comment--text-container'
    );
    textContainer.createEl('p', {
      text: comment.data.text,
      cls: 'trello-comment--text'
    });
  }

  private renderNavButton(
    parent: HTMLElement,
    label: string,
    icon: string,
    callback: () => any
  ) {
    const button = parent.createDiv({
      cls: 'nav-action-button',
      attr: { 'aria-label': label }
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
  }
}
