import { BehaviorSubject, Observable } from 'rxjs';
import { filter, finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { TrelloPlugin } from '../plugin';
import { PluginError, TrelloAction, TrelloCard, TrelloList } from '../interfaces';

/**
 * Provides state and error handling for the view.
 */
export class TrelloViewManager {
  // Cache bust
  private bypassActionCache = false;
  private bypassListCache = false;

  // Error handling
  cardError: PluginError | null = null;
  actionsError: PluginError | null = null;
  listError: PluginError | null = null;

  // Data
  readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);
  readonly currentActions = new BehaviorSubject<TrelloAction[] | null>(null);
  readonly currentList = new BehaviorSubject<TrelloList | null>(null);

  constructor(
    private readonly plugin: TrelloPlugin,
    private readonly destroy: Observable<void>,
    private readonly update: Observable<void>
  ) {
    // Update card when the current ID changes
    this.plugin.boardCardId
      .pipe(
        takeUntil(this.destroy),
        tap((boardCard) => {
          // If there is no card associated with this list, reset everything
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
          // Get card from cache/api
          const [boardId, cardId] = boardCard!.split(';');
          return this.plugin.api.getCardFromBoard(boardId, cardId);
        })
      )
      .subscribe({
        next: (card) => {
          // If card has changed, reset the actions and list to avoid inaccurate renders
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
      .subscribe({
        next: (card) => {
          this.cardError = null;
          if (card) {
            this.currentCard.next(card);
          }
        },
        error: (err: PluginError) => {
          this.cardError = err;
          this.currentCard.next(null);
        }
      });
  }
}
