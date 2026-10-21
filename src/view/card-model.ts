import { BehaviorSubject, Observable, Subject, combineLatest, forkJoin, of } from 'rxjs';
import {
  CardRef,
  PluginError,
  PluginUISettings,
  TrelloAction,
  TrelloCard,
  TrelloChecklist,
  TrelloList
} from '../interfaces';
import { catchError, concatMap, map, startWith, switchMap, take, takeUntil, tap } from 'rxjs/operators';

import { TrelloPlugin } from '../plugin';
import { formatCardRef } from '../yaml-handler';

/**
 * Loads and holds everything the view needs for one linked card.
 */
export class CardModel {
  readonly key: string;

  // Error handling
  cardError: PluginError | null = null;
  actionsError: PluginError | null = null;
  listError: PluginError | null = null;
  checklistsError: PluginError | null = null;

  // Data
  readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);
  readonly currentActions = new BehaviorSubject<TrelloAction[] | null>(null);
  readonly currentList = new BehaviorSubject<TrelloList | null>(null);
  readonly currentChecklists = new BehaviorSubject<TrelloChecklist[] | null>(null);

  /** Emits whenever any part of the card changes */
  readonly state = combineLatest([this.currentCard, this.currentActions, this.currentList, this.currentChecklists]);

  private readonly destroy = new Subject<void>();
  // Emits true to bypass the caches
  private readonly load = new Subject<boolean>();
  // Emits when the card itself is available, the extra data hangs off this
  private readonly loaded = new BehaviorSubject<{ card: TrelloCard; bypass: boolean } | null>(null);

  constructor(
    private readonly plugin: TrelloPlugin,
    readonly ref: CardRef,
    uiConfig: Observable<PluginUISettings | null>
  ) {
    this.key = formatCardRef(ref);

    // Actions
    combineLatest([this.loaded, uiConfig])
      .pipe(
        switchMap(([loaded, config]) => {
          if (!loaded || !config?.comments) {
            this.actionsError = null;
            return of(null);
          }
          return this.plugin.api.getActionsFromCard(loaded.card.id, undefined, loaded.bypass).pipe(
            catchError((err: PluginError) => {
              this.actionsError = err;
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy)
      )
      .subscribe((actions) => {
        if (actions !== null) {
          this.actionsError = null;
        }
        this.currentActions.next(actions);
      });

    // List
    combineLatest([this.loaded, uiConfig])
      .pipe(
        switchMap(([loaded, config]) => {
          if (!loaded || !config?.list) {
            this.listError = null;
            return of(null);
          }
          return this.plugin.api.getList(loaded.card.idList, loaded.bypass).pipe(
            catchError((err: PluginError) => {
              this.listError = err;
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy)
      )
      .subscribe((list) => {
        if (list !== null) {
          this.listError = null;
        }
        this.currentList.next(list);
      });

    // Checklists
    combineLatest([this.loaded, uiConfig])
      .pipe(
        switchMap(([loaded, config]) => {
          if (!loaded || !config?.checklists) {
            this.checklistsError = null;
            return of(null);
          }
          const { card, bypass } = loaded;
          if (!card.idChecklists || card.idChecklists.length === 0) {
            return of([] as TrelloChecklist[]);
          }
          return this.plugin.api.getChecklistsFromCard(card.id, card.idChecklists, bypass).pipe(
            map((checklists) => {
              checklists.sort((a, b) => (a.pos < b.pos ? -1 : 1));
              checklists.forEach((checklist) => {
                checklist.checkItems.sort((a, b) => (a.pos < b.pos ? -1 : 1));
              });
              return checklists;
            }),
            catchError((err: PluginError) => {
              this.checklistsError = err;
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy)
      )
      .subscribe((checklists) => {
        if (checklists !== null) {
          this.checklistsError = null;
        }
        this.currentChecklists.next(checklists);
      });

    // Card. Subscribed last so the pipelines above see the first, possibly synchronous, emission.
    this.load
      .pipe(
        startWith(false),
        switchMap((bypass) =>
          this.plugin.api.getCard(ref.boardId, ref.cardId, bypass).pipe(
            map((card) => ({ card, bypass })),
            catchError((err: PluginError) => {
              this.cardError = err;
              this.currentCard.next(null);
              this.loaded.next(null);
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy)
      )
      .subscribe((loaded) => {
        if (!loaded) {
          return;
        }
        const { card, bypass } = loaded;
        this.plugin.log('CardModel', `-> Card ${card.id} updated.`);
        this.cardError = null;
        this.currentCard.next(card);
        this.loaded.next({ card, bypass });
        // The card may have moved to another board since the note was linked
        if (this.plugin.state.getSetting('followMovedCards')) {
          void this.plugin.syncCardBoard(card).catch(() => undefined);
        }
      });
  }

  /**
   * Reload the card and everything attached to it, ignoring caches.
   */
  refresh(): void {
    this.plugin.log('CardModel', 'Refreshing data.');
    this.load.next(true);
  }

  dispose(): void {
    this.destroy.next();
    this.destroy.complete();
  }

  /**
   * Move the card from one list to a newly selected one
   * on the same board.
   */
  moveCard(): void {
    const card = this.currentCard.value;
    const currentList = this.currentList.value;
    if (!card || !currentList) {
      return;
    }
    this.plugin.log('CardModel.moveCard', 'Beginning move card flow');
    forkJoin({
      list: this.plugin.api.getListsFromBoard(card.idBoard).pipe(
        // Copy rather than rename, these objects are shared with the list cache
        map((lists) => lists.map((l) => (l.id === currentList.id ? { ...l, name: `${l.name} (current list)` } : l))),
        concatMap((lists) => {
          this.plugin.log('CardModel.moveCard', '-> Got all lists for board.');
          this.plugin.listSuggestModal.options = lists;
          this.plugin.listSuggestModal.open();
          return this.plugin.listSuggestModal.selected;
        }),
        take(1),
        tap((newList) => {
          this.plugin.log('CardModel.moveCard', `-> Selected list ${newList.id}. Updating card.`);
        })
      ),
      position: this.plugin.state.settings.pipe(
        take(1),
        map((s) => s.movedCardPosition),
        tap((position) => {
          this.plugin.log('CardModel.moveCard', `-> Moved card position: ${position}`);
        })
      )
    })
      .pipe(concatMap(({ list, position }) => this.plugin.api.updateCardList(card.id, list.id, position)))
      .subscribe({
        next: (updatedCard) => {
          this.plugin.log('CardModel.moveCard', '-> Updated card.');
          this.currentCard.next(updatedCard);
          this.loaded.next({ card: updatedCard, bypass: false });
        },
        error: (err: PluginError) => {
          if (err !== PluginError.Abort) {
            this.plugin.log('CardModel.moveCard', `-> Could not move card: ${err}`);
          }
        }
      });
  }
}
