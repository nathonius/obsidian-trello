import { CUSTOM_ICONS, TRELLO_ERRORS, TRELLO_MY_CARDS_VIEW_TYPE } from '../constants';
import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import { MyCardsSort, PluginError, TrelloBoardWithLists, TrelloCard } from '../interfaces';
import { Subject, forkJoin } from 'rxjs';

import { TrelloPlugin } from '../plugin';
import { takeUntil } from 'rxjs/operators';

/**
 * Lists the open cards assigned to the current user across all boards.
 */
export class TrelloMyCardsView extends ItemView {
  private readonly destroy = new Subject<void>();
  private readonly refresh = new Subject<void>();
  private cards: TrelloCard[] = [];
  private boards: TrelloBoardWithLists[] = [];
  private error: PluginError | null = null;
  private loading = true;

  constructor(
    private readonly plugin: TrelloPlugin,
    leaf: WorkspaceLeaf
  ) {
    super(leaf);
  }

  getDisplayText(): string {
    return 'My Trello cards';
  }

  getViewType(): string {
    return TRELLO_MY_CARDS_VIEW_TYPE;
  }

  getIcon(): string {
    return CUSTOM_ICONS.trello.id;
  }

  async onOpen(): Promise<void> {
    this.render();
    this.fetchCards();
  }

  async onClose(): Promise<void> {
    this.destroy.next();
    this.destroy.complete();
  }

  /**
   * Fetch cards and boards. A new call replaces any request still in flight.
   */
  private fetchCards(): void {
    this.refresh.next();
    this.loading = true;
    this.render();
    forkJoin({ cards: this.plugin.api.getMyCards(), boards: this.plugin.api.getBoardsWithLists() })
      .pipe(takeUntil(this.refresh), takeUntil(this.destroy))
      .subscribe({
        next: ({ cards, boards }) => {
          this.cards = cards;
          this.boards = boards;
          this.error = null;
          this.loading = false;
          this.render();
        },
        error: (err: PluginError) => {
          this.error = err;
          this.loading = false;
          this.render();
        }
      });
  }

  private render(): void {
    this.contentEl.empty();
    this.renderHeader();
    const pane = this.contentEl.createDiv('trello-my-cards--container');

    if (this.error !== null) {
      this.renderError(pane, this.error);
    } else if (this.loading) {
      pane.createDiv({ text: 'Loading cards...', cls: 'trello-my-cards--message' });
    } else if (this.cards.length === 0) {
      pane.createDiv({ text: 'No cards are assigned to you.', cls: 'trello-my-cards--message' });
    } else if (this.plugin.state.getSetting('myCardsSort') === MyCardsSort.Due) {
      this.renderCards(pane, this.sortByDue(this.cards), true);
    } else {
      this.renderByBoard(pane);
    }
  }

  private renderHeader(): void {
    const header = this.contentEl.createDiv('nav-header');
    const buttons = header.createDiv('nav-buttons-container');
    const refreshButton = buttons.createDiv({ cls: 'nav-action-button', attr: { 'aria-label': 'Refresh cards' } });
    setIcon(refreshButton, 'reset');
    refreshButton.addEventListener('click', () => this.fetchCards());

    const select = buttons.createEl('select', {
      cls: 'dropdown trello-my-cards--sort',
      attr: { 'aria-label': 'Sort' }
    });
    select.createEl('option', { text: 'Group by board', attr: { value: MyCardsSort.Board } });
    select.createEl('option', { text: 'Sort by due date', attr: { value: MyCardsSort.Due } });
    select.value = this.plugin.state.getSetting('myCardsSort');
    select.addEventListener('change', () => {
      this.plugin.state.updateSetting('myCardsSort', select.value as MyCardsSort);
      this.render();
    });
  }

  private renderError(parent: HTMLElement, error: PluginError): void {
    if (error === PluginError.NoToken || error === PluginError.Unauthorized) {
      parent.createDiv({
        text: error === PluginError.NoToken ? TRELLO_ERRORS.noToken : TRELLO_ERRORS.unauthorized,
        cls: 'trello-my-cards--message'
      });
      const button = parent.createEl('button', { text: 'Setup Trello', attr: { type: 'button' } });
      button.addEventListener('click', () => this.plugin.openTrelloSettings());
    } else if (error === PluginError.RateLimit) {
      parent.createDiv({ text: TRELLO_ERRORS.rateLimit, cls: 'trello-my-cards--message' });
    } else {
      parent.createDiv({ text: TRELLO_ERRORS.other, cls: 'trello-my-cards--message' });
    }
  }

  private renderByBoard(parent: HTMLElement): void {
    const boardsById = new Map(this.boards.map((b) => [b.id, b]));
    const cardsByBoard = new Map<string, TrelloCard[]>();
    this.cards.forEach((card) => {
      const group = cardsByBoard.get(card.idBoard) ?? [];
      group.push(card);
      cardsByBoard.set(card.idBoard, group);
    });

    const boardIds = [...cardsByBoard.keys()].sort((a, b) =>
      (boardsById.get(a)?.name ?? '').localeCompare(boardsById.get(b)?.name ?? '')
    );
    boardIds.forEach((boardId) => {
      const section = parent.createDiv('trello-my-cards--board');
      section.createEl('h4', { text: boardsById.get(boardId)?.name ?? 'Unknown board' });
      this.renderCards(section, this.sortByDue(cardsByBoard.get(boardId) ?? []), false);
    });
  }

  private renderCards(parent: HTMLElement, cards: TrelloCard[], showBoard: boolean): void {
    cards.forEach((card) => this.renderCard(parent, card, showBoard));
  }

  private renderCard(parent: HTMLElement, card: TrelloCard, showBoard: boolean): void {
    const container = parent.createDiv('trello-my-cards--card');

    const link = this.plugin.state.getSetting('openInDesktop') ? card.url.replace('https', 'trello') : card.url;
    container.createEl('a', { text: card.name, cls: 'trello-my-cards--card-title', attr: { href: link } });

    const board = this.boards.find((b) => b.id === card.idBoard);
    const list = board?.lists.find((l) => l.id === card.idList);
    const location = [showBoard ? board?.name : null, list?.name].filter((s) => !!s).join(' / ');
    const meta = container.createDiv('trello-my-cards--card-meta');
    if (location) {
      meta.createSpan({ text: location, cls: 'trello-my-cards--card-location' });
    }
    if (card.due) {
      const due = new Date(card.due);
      const overdue = !card.dueComplete && due.getTime() < Date.now();
      meta.createSpan({
        text: due.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        cls: ['trello-my-cards--card-due', overdue ? 'is-overdue' : '', card.dueComplete ? 'is-complete' : '']
          .filter((c) => c)
          .join(' ')
      });
    }
    card.labels
      ?.filter((label) => label.color)
      .forEach((label) => {
        meta.createSpan({
          cls: `trello-label trello-color--${label.color}`,
          attr: { 'aria-label': label.name !== '' ? label.name : null }
        });
      });
  }

  /**
   * Soonest due date first, cards without a due date last.
   */
  private sortByDue(cards: TrelloCard[]): TrelloCard[] {
    return [...cards].sort((a, b) => {
      if (a.due && b.due) {
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      }
      if (a.due || b.due) {
        return a.due ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
}
