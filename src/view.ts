import { ItemView, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import { BehaviorSubject, combineLatest, forkJoin, of, Subject, throwError } from 'rxjs';
import { catchError, concatMap, filter, finalize, mergeMap, switchMap, takeUntil, tap } from 'rxjs/operators';
import { CUSTOM_ICONS, TRELLO_ERRORS, TRELLO_VIEW_TYPE } from './constants';
import { PluginError, TrelloAction, TrelloCard, TrelloList } from './interfaces';
import { TrelloPlugin } from './plugin';

export class TrelloView extends ItemView {
  // Cache bust
  private bypassActionCache = false;
  private bypassListCache = false;

  // Error handling
  private cardError: PluginError | null = null;
  private actionsError: PluginError | null = null;
  private listError: PluginError | null = null;

  // Data
  private readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);
  private readonly currentActions = new BehaviorSubject<TrelloAction[] | null>(null);
  private readonly currentList = new BehaviorSubject<TrelloList | null>(null);

  // Flow control
  private readonly destroy = new Subject<void>();
  private readonly update = new Subject<void>();
  constructor(private readonly plugin: TrelloPlugin, leaf: WorkspaceLeaf) {
    super(leaf);

    // Update card
    this.plugin.boardCardId
      .pipe(
        takeUntil(this.destroy),
        tap((boardCard) => {
          if (!boardCard) {
            this.cardError = null;
            this.actionsError = null;
            this.listError = null;
            this.currentCard.next(null);
            this.currentActions.next(null);
            this.currentList.next(null);
          }
        }),
        filter((boardCard) => boardCard !== null && boardCard !== ''),
        switchMap((boardCard) => {
          const [boardId, cardId] = boardCard!.split(';');
          return this.plugin.api.getCardFromBoard(boardId, cardId);
        })
      )
      .subscribe({
        next: (card) => {
          if (this.currentCard.value !== null && this.currentCard.value.id !== card.id) {
            this.currentActions.next(null);
            this.currentList.next(null);
          }
          this.cardError = null;
          this.currentCard.next(card);
        },
        error: (err: PluginError) => {
          this.cardError = err;
          this.currentCard.next(null);
        }
      });

    // Update actions
    this.currentCard
      .pipe(
        takeUntil(this.destroy),
        filter((card) => card !== null),
        switchMap((card) => this.plugin.api.getActionsFromCard(card!.id, undefined, this.bypassActionCache)),
        finalize(() => {
          this.bypassActionCache = false;
        })
      )
      .subscribe({
        next: (actions) => {
          this.actionsError = null;
          this.currentActions.next(actions);
        },
        error: (err: PluginError) => {
          this.actionsError = err;
          this.currentActions.next(null);
        }
      });

    // Update list
    this.currentCard
      .pipe(
        takeUntil(this.destroy),
        filter((card) => card !== null),
        switchMap((card) => this.plugin.api.getList(card!.idList, this.bypassListCache)),
        finalize(() => {
          this.bypassListCache = false;
        })
      )
      .subscribe({
        next: (list) => {
          this.listError = null;
          this.currentList.next(list);
        },
        error: (err: PluginError) => {
          this.listError = err;
          this.currentList.next(null);
        }
      });

    // Refresh data
    this.update
      .pipe(
        takeUntil(this.destroy),
        filter(() => this.currentCard.value !== null),
        tap(() => {
          this.bypassActionCache = true;
          this.bypassListCache = true;
        }),
        switchMap(() => {
          const card = this.currentCard.value!;
          return this.plugin.api.getCardFromBoard(card.idBoard, card.id, true);
        })
      )
      .subscribe((card) => {
        if (card) {
          this.currentCard.next(card);
        }
      });

    // Render
    combineLatest([this.currentCard, this.currentActions, this.currentList])
      .pipe(takeUntil(this.destroy))
      .subscribe(([card, actions, list]) => {
        this.contentEl.empty();
        const errors = [this.cardError, this.actionsError, this.listError];
        if (errors.some((err) => err !== null)) {
          this.renderEmptyView(this.getWorstError(errors));
        } else if (card === null) {
          this.renderEmptyView(null);
        } else {
          this.renderConnectedView(card, actions, list);
        }
      });
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

  private renderEmptyView(error: PluginError | null) {
    const pane = this.renderPaneContainer();
    if (error === null || error === PluginError.NoToken) {
      pane.createEl('h2', { text: 'No Trello card connected.' });
      if (error === PluginError.NoToken) {
        pane.createDiv({ text: 'An API token is required.' });
        const tokenButton = pane.createEl('button', {
          text: 'Setup Trello',
          attr: { type: 'button' }
        });
        tokenButton.addEventListener('click', () => {
          this.plugin.openTrelloSettings();
        });
      } else {
        const connectButton = pane.createEl('button', {
          text: 'Connect Trello Card',
          attr: { type: 'button' }
        });
        connectButton.addEventListener('click', () => {
          this.plugin.connectTrelloCard();
        });
      }
    } else {
      pane.createEl('h2', { text: 'Could not reach Trello API.' });
      if (error === PluginError.RateLimit) {
        pane.createDiv({ text: TRELLO_ERRORS.rateLimit });
      } else if (error === PluginError.Unauthorized) {
        pane.createDiv({ text: TRELLO_ERRORS.unauthorized });
        const tokenButton = pane.createEl('button', {
          text: 'Setup Trello',
          attr: { type: 'button' }
        });
        tokenButton.addEventListener('click', () => {
          this.plugin.openTrelloSettings();
        });
      } else {
        pane.createDiv({ text: TRELLO_ERRORS.other });
      }
    }
  }

  private renderConnectedView(card: TrelloCard, actions: TrelloAction[] | null, list: TrelloList | null): void {
    this.renderHeader(this.contentEl);
    const pane = this.renderPaneContainer();
    const cardInfo = pane.createDiv('trello-pane--card-info');
    this.renderCardInfo(card, list, cardInfo);
    if (card.labels && card.labels.length > 0) {
      const labelSectionContainer = pane.createDiv('trello-pane--label-section');
      this.renderLabels(card, labelSectionContainer);
    }
    const commentSectionContainer = pane.createDiv('trello-pane--comment-section');
    this.renderCommentSection(card, actions, commentSectionContainer);
  }

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv('nav-header');
    const buttons = header.createDiv('nav-buttons-container');
    this.renderNavButton(buttons, 'Refresh card', 'reset', () => {
      this.update.next();
    });
    this.renderNavButton(buttons, 'Link another card', 'link', () => {
      this.plugin.connectTrelloCard();
    });
    this.renderNavButton(buttons, 'Unlink card', 'trash', () => {
      this.plugin.disconnectTrelloCard();
    });
  }

  private renderCardInfo(card: TrelloCard, list: TrelloList | null, parent: HTMLElement): void {
    if (list) {
      const listName = parent.createDiv({
        cls: 'trello-pane--card-info--list',
        text: list.name
      });
      const listIcon = listName.createSpan();
      setIcon(listIcon, 'right-arrow-with-tail');
    }
    const cardName = parent.createEl('h3', { text: card.name });
    const cardLink = cardName.createEl('a', {
      attr: { href: card.url, 'aria-label': 'View on Trello' }
    });
    setIcon(cardLink, 'navigate-glyph', 24);

    const descContainer = parent.createDiv('trello-card-desc--container');
    const collapseButton = descContainer.createEl('a', {
      text: 'Description',
      cls: 'trello-card-desc--collapse',
      href: '#'
    });
    const collapseIcon = collapseButton.createSpan('trello-card-desc--collapse-icon');
    setIcon(collapseIcon, 'down-chevron-glyph');
    const description = descContainer.createDiv({ text: card.desc, cls: 'trello-card-desc--desc' });
    collapseButton.addEventListener('click', () => {
      if (description.style.maxHeight) {
        description.style.maxHeight = '';
        setIcon(collapseIcon, 'down-chevron-glyph');
      } else {
        description.style.maxHeight = description.scrollHeight + 'px';
        setIcon(collapseIcon, 'up-chevron-glyph');
      }
    });
  }

  private renderLabels(card: TrelloCard, parent: HTMLElement): void {
    card.labels.forEach((label) => {
      if (label.color) {
        parent.createSpan({
          cls: `trello-label trello-color--${label.color}`,
          attr: { 'aria-label': label.name !== '' ? label.name : null }
        });
      }
    });
  }

  private renderCommentSection(card: TrelloCard, comments: TrelloAction[] | null, parent: HTMLElement): void {
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
    const commentMetadata = commentContainer.createDiv('trello-comment--metadata');
    commentMetadata.createSpan({
      text: comment.memberCreator.fullName,
      cls: 'trello-comment--creator'
    });
    commentMetadata.createSpan({
      text: new Date(comment.date).toLocaleString(),
      cls: 'trello-comment--date'
    });
    const textContainer = commentContainer.createDiv('trello-comment--text-container');
    textContainer.createEl('p', {
      text: comment.data.text,
      cls: 'trello-comment--text'
    });
  }

  private renderNavButton(parent: HTMLElement, label: string, icon: string, callback: () => any) {
    const button = parent.createDiv({
      cls: 'nav-action-button',
      attr: { 'aria-label': label }
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
  }

  private getWorstError(errors: Array<PluginError | null>): PluginError | null {
    let worstError: PluginError | null = null;
    errors.forEach((err) => {
      switch (worstError) {
        case null:
        case PluginError.NoToken:
          if (err !== null) {
            worstError = err;
          }
          break;
        case PluginError.RateLimit:
          if (err === PluginError.Unauthorized) {
            worstError = err;
          }
          break;
      }
    });
    return worstError;
  }
}
