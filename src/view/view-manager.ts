import { BehaviorSubject, forkJoin, Observable, combineLatest, of } from 'rxjs';
import { concatMap, filter, finalize, switchMap, take, takeUntil, tap, map, mergeMap } from 'rxjs/operators';
import { TrelloPlugin } from '../plugin';
import { PluginError, PluginUISettings, TrelloAction, TrelloCard, TrelloChecklist, TrelloList } from '../interfaces';
import { GLOBAL_UI } from 'src/constants';

/**
 * Provides state and error handling for the view.
 */
export class TrelloViewManager {
  // Cache bust
  private bypassActionCache = false;
  private bypassListCache = false;
  private bypassChecklistsCache = false;

  // Error handling
  cardError: PluginError | null = null;
  actionsError: PluginError | null = null;
  listError: PluginError | null = null;
  checklistsError: PluginError | null = null;

  // Data
  readonly connectedId = new BehaviorSubject<string | null>(null);
  readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);
  readonly currentActions = new BehaviorSubject<TrelloAction[] | null>(null);
  readonly currentList = new BehaviorSubject<TrelloList | null>(null);
  readonly currentChecklists = new BehaviorSubject<TrelloChecklist[] | null>(null);
  readonly currentUIConfig = new BehaviorSubject<PluginUISettings | null>(null);

  constructor(
    private readonly plugin: TrelloPlugin,
    private readonly destroy: Observable<void>,
    private readonly update: Observable<void>
  ) {
    // Update card when the current board/card ID changes
    this.plugin.state.boardCardId
      .pipe(
        takeUntil(this.destroy),
        tap((boardCardId) => {
          // If there is no card associated with this list, reset everything
          if (!boardCardId) {
            this.cardError = null;
            this.actionsError = null;
            this.listError = null;
            this.currentCard.next(null);
            this.currentActions.next(null);
            this.currentList.next(null);
          }
        }),
        filter((boardCardId) => boardCardId !== null && boardCardId !== ''),
        switchMap((boardCardId) => {
          const [boardId, cardId] = boardCardId!.split(';');
          this.plugin.log('TrelloViewManager', `-> Got new board/card ID ${boardId}/${cardId}`);
          this.plugin.log('TrelloViewManager', '-> Getting card from API/cache.');
          // Get card from cache/api
          return this.plugin.api.getCardFromBoard(boardId, cardId);
        })
      )
      .subscribe({
        next: (card) => {
          // If card has changed, reset the actions and list to avoid inaccurate renders
          if (this.currentCard.value !== null && this.currentCard.value.id !== card.id) {
            this.plugin.log('TrelloViewManager', 'Card changed, resetting extra info.');
            this.currentActions.next(null);
            this.currentList.next(null);
          }
          this.cardError = null;
          this.plugin.log('TrelloViewManager', '-> Card updated.');
          this.currentCard.next(card);
        },
        error: (err: PluginError) => {
          this.cardError = err;
          this.currentCard.next(null);
        }
      });

    // Update card UI when the current plugin ID changes
    this.plugin.state.connectedCardId
      .pipe(
        takeUntil(this.destroy),
        tap((connected) => {
          if (!connected) {
            this.connectedId.next(null);
            this.currentUIConfig.next(null);
          }
        }),
        filter((connected) => connected !== null && connected !== ''),
        tap((connected) => {
          this.connectedId.next(connected);
        }),
        mergeMap((connected) => combineLatest([of(connected), this.plugin.state.settings.pipe(map((s) => s.customUi))]))
      )
      .subscribe(([connected, customUiSettings]) => {
        const uiConfig = customUiSettings[connected as string]
          ? customUiSettings[connected as string]
          : customUiSettings[GLOBAL_UI];
        this.currentUIConfig.next(uiConfig);
        this.plugin.log('TrelloViewManager', `Connected card with ${connected}`);
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
          this.plugin.log('TrelloViewManager', 'Actions updated.');
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
          this.plugin.log('TrelloViewManager', 'List updated.');
          this.listError = null;
          this.currentList.next(list);
        },
        error: (err: PluginError) => {
          this.listError = err;
          this.currentList.next(null);
        }
      });

    // Update checklists
    this.currentCard
      .pipe(
        takeUntil(this.destroy),
        filter((card) => card !== null && card.idChecklists !== null && card.idChecklists.length > 0),
        switchMap((card) =>
          this.plugin.api.getChecklistsFromCard(card!.id, card!.idChecklists, this.bypassChecklistsCache)
        ),
        map((checklists) => {
          // Sort checklists
          checklists.sort((a, b) => (a.pos < b.pos ? -1 : 1));

          // Sort each checklist item
          checklists.forEach((list) => {
            list.checkItems.sort((a, b) => (a.pos < b.pos ? -1 : 1));
          });
          return checklists;
        }),
        finalize(() => {
          this.bypassChecklistsCache = false;
        })
      )
      .subscribe({
        next: (checklists) => {
          this.plugin.log('TrelloViewManager', 'Checklist updated.');
          this.checklistsError = null;
          this.currentChecklists.next(checklists);
        },
        error: (err: PluginError) => {
          this.checklistsError = err;
          this.currentChecklists.next(null);
        }
      });

    // Refresh data
    this.update
      .pipe(
        takeUntil(this.destroy),
        filter(() => this.currentCard.value !== null),
        tap(() => {
          this.plugin.log('TrelloViewManager', 'Refreshing data.');
          this.bypassActionCache = true;
          this.bypassListCache = true;
          this.bypassChecklistsCache = true;
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
            this.plugin.log('TrelloViewManager', '-> Got updated card.');
            this.currentCard.next(card);
          }
        },
        error: (err: PluginError) => {
          this.cardError = err;
          this.currentCard.next(null);
        }
      });
  }

  /**
   * Move the current card from one list to a newly selected one
   * on the same board.
   */
  moveCard(): void {
    if (this.currentCard.value && this.currentList.value) {
      this.plugin.log('TrelloViewManager.moveCard', 'Beginning move card flow');
      const card = this.currentCard.value;
      const currentList = this.currentList.value;
      forkJoin({
        list: this.plugin.api.getListsFromBoard(card.idBoard).pipe(
          map((lists) => {
            this.plugin.log('TrelloViewManager.moveCard', '-> Marking current list.');
            const current = lists.find((l) => l.id === currentList.id);
            if (current) {
              current.name = `${current.name} (current list)`;
            }
            return lists;
          }),
          concatMap((lists) => {
            this.plugin.log('TrelloViewManager.moveCard', '-> Got all lists for board.');
            this.plugin.listSuggestModal.options = lists;
            this.plugin.listSuggestModal.open();
            return this.plugin.listSuggestModal.selected;
          }),
          take(1),
          tap((newList) => {
            this.plugin.log('TrelloViewManager.moveCard', `-> Selected list ${newList.id}. Updating card.`);
          })
        ),
        position: this.plugin.state.settings.pipe(
          take(1),
          map((s) => s.movedCardPosition),
          tap((position) => {
            this.plugin.log('TrelloViewManager.moveCard', `-> Moved card position: ${position}`);
          })
        )
      })
        .pipe(concatMap(({ list, position }) => this.plugin.api.updateCardList(card.id, list.id, position)))
        .subscribe({
          next: (updatedCard) => {
            this.plugin.log('TrelloViewManager.moveCard', '-> Updated card.');
            this.currentCard.next(updatedCard);
          },
          error: (err: PluginError) => {
            if (err === PluginError.Abort) {
              return;
            }
          }
        });
    }
  }
}
