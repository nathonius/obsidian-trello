import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { ajax as RxJSAjax, AjaxConfig, AjaxError, AjaxResponse } from 'rxjs/ajax';
import { map, tap, catchError } from 'rxjs/operators';
import { TRELLO_API, TRELLO_API_KEY } from './constants';
import {
  CardPosition,
  NewCardRequest,
  PluginError,
  TrelloAction,
  TrelloActionType,
  TrelloBoard,
  TrelloCard,
  TrelloCheckItem,
  TrelloCheckItemState,
  TrelloChecklist,
  TrelloItemCache,
  TrelloLabel,
  TrelloList
} from './interfaces';
import { PluginState } from './state';

export type CacheState = Pick<
  PluginState,
  'cardActionsCache' | 'cardCache' | 'checklistCache' | 'labelCache' | 'listCache'
>;

export class TrelloAPI {
  private readonly token = new BehaviorSubject<string>('');

  constructor(
    token: Observable<string>,
    private readonly state: CacheState,
    private readonly log: (source: string, msg: string) => void,
    private readonly ajax: typeof RxJSAjax = RxJSAjax
  ) {
    token.subscribe(this.token);
  }

  /**
   * Get all boards for current user.
   * This is not cached.
   */
  getBoards(): Observable<TrelloBoard[]> {
    this.log('TrelloAPI.getBoards', '');
    const url = `${TRELLO_API}/1/members/me/boards?fields=name,url`;
    return this.callAPI<TrelloBoard[]>({ url, crossDomain: true }).pipe(map((resp) => resp.response));
  }

  /**
   * Get a specific card by board and card ID.
   * This uses the cache if possible.
   */
  getCardFromBoard(boardId: string, cardId: string, bypassCache = false): Observable<TrelloCard> {
    this.log('TrelloAPI.getCardFromBoard', '');
    const cached = this.checkCache(this.state.cardCache, cardId, bypassCache, 12000);
    if (!cached) {
      return this._getCardFromBoard(boardId, cardId);
    }
    this.log('TrelloAPI.getCardFromBoard', '-> Returning cached value.');
    return of(cached);
  }

  /**
   * Get a specific card by board and card ID.
   * Always calls API and updates cache.
   */
  private _getCardFromBoard(boardId: string, cardId: string): Observable<TrelloCard> {
    const url = `${TRELLO_API}/1/boards/${boardId}/cards/${cardId}`;
    return this.callAPI<TrelloCard>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((card) => {
        if (card) {
          this.state.cardCache[card.id] = {
            item: card,
            timestamp: new Date()
          };
        }
      })
    );
  }

  /**
   * Get all labels for a given board.
   * This uses the cache if possible.
   */
  getLabelsFromBoard(boardId: string, bypassCache = false): Observable<TrelloLabel[]> {
    this.log('TrelloAPI.getLabelsFromBoard', '');
    const cached = this.checkCache(this.state.labelCache, boardId, bypassCache, 600000);
    if (!cached) {
      return this._getLabelsFromBoard(boardId);
    }
    this.log('TrelloAPI.getLabelsFromBoard', '-> Returning cached value.');
    return of(cached);
  }

  /**
   * Get all labels for a given board.
   * This updates the cache.
   */
  private _getLabelsFromBoard(boardId: string): Observable<TrelloLabel[]> {
    const url = `${TRELLO_API}/1/boards/${boardId}/labels`;
    return this.callAPI<TrelloLabel[]>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((labels) => {
        this.state.labelCache[boardId] = { item: labels, timestamp: new Date() };
      })
    );
  }

  /**
   * Get all lists for the given board.
   * This is not cached, but updates the cache.
   */
  getListsFromBoard(boardId: string): Observable<TrelloList[]> {
    this.log('TrelloAPI.getListsFromBoard', '');
    const url = `${TRELLO_API}/1/boards/${boardId}/lists`;
    return this.callAPI<TrelloList[]>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((lists) => {
        if (lists && lists.length > 0) {
          lists.forEach((list) => {
            this.state.listCache[list.id] = { item: list, timestamp: new Date() };
          });
        }
      })
    );
  }

  /**
   * Get a specific list by list ID.
   * This uses cache if possible.
   */
  getList(listId: string, bypassCache = false): Observable<TrelloList> {
    this.log('TrelloAPI.getList', '');
    const cached = this.checkCache(this.state.listCache, listId, bypassCache, 600000);
    if (!cached) {
      return this._getList(listId);
    }
    this.log('TrelloAPI.getList', '-> Returning cached value.');
    return of(cached);
  }

  /**
   * Get a specific list by list ID.
   * Always calls API and updates cache.
   */
  private _getList(listId: string): Observable<TrelloList> {
    const url = `${TRELLO_API}/1/lists/${listId}`;
    return this.callAPI<TrelloList>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((list) => {
        if (list) {
          this.state.listCache[list.id] = { item: list, timestamp: new Date() };
        }
      })
    );
  }

  /**
   * Get all cards from a board by board ID.
   * This always calls the API and updates the cache.
   */
  getCardsFromBoard(boardId: string): Observable<TrelloCard[]> {
    this.log('TrelloAPI.getCardsFromBoard', '');
    const url = `${TRELLO_API}/1/boards/${boardId}/cards`;
    return this.callAPI<TrelloCard[]>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((cards) => {
        cards.forEach((card) => {
          this.state.cardCache[card.id] = {
            item: card,
            timestamp: new Date()
          };
        });
      })
    );
  }

  /**
   * Get all actions from a card by card ID.
   * For now actionTypes is just comments.
   * Uses cache if possible.
   */
  getActionsFromCard(
    cardId: string,
    actionTypes: string[] = [TrelloActionType.Comment],
    bypassCache = false
  ): Observable<TrelloAction[]> {
    this.log('TrelloAPI.getActionsFromCard', '');
    const cached = this.checkCache(this.state.cardActionsCache, cardId, bypassCache, 60000);
    if (!cached) {
      return this._getActionsFromCard(cardId, actionTypes);
    }
    this.log('TrelloAPI.getActionsFromCard', '-> Returning cached value.');
    return of(cached);
  }

  /**
   * Get all actions from a card by card ID.
   * Always calls the API and updates the cache.
   */
  private _getActionsFromCard(
    cardId: string,
    actionTypes: string[] = [TrelloActionType.Comment]
  ): Observable<TrelloAction[]> {
    const url = `${TRELLO_API}/1/cards/${cardId}/actions?filter=${actionTypes.join(',')}`;
    return this.callAPI<TrelloAction[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((actions) => {
        if (actions) {
          this.state.cardActionsCache[cardId] = { item: actions, timestamp: new Date() };
        }
      })
    );
  }

  /**
   * Get all checklists from a card by card ID.
   * Does not use cache
   */
  getChecklistsFromCard(
    cardId: string,
    checklistIds: string[] = [],
    bypassCache = false,
    cacheExpireMs = 60000 // 1 minute
  ): Observable<TrelloChecklist[]> {
    this.log('TrelloAPI.getChecklistsFromCard', '');
    const cached = checklistIds.map((id) => this.state.checklistCache[id]);
    const cacheDate = new Date().getTime();
    if (
      !cached ||
      bypassCache ||
      cached.some((checklist) => checklist === undefined || cacheDate - checklist.timestamp.getTime() > cacheExpireMs)
    ) {
      return this._getChecklistsFromCard(cardId);
    }
    this.log('TrelloAPI.getChecklistsFromCard', '-> Returning cached value.');
    return of(cached.map((c) => c.item));
  }

  /**
   * Get all checklists from a card by card ID.
   * Always calls the API and updates the cache.
   */
  private _getChecklistsFromCard(cardId: string): Observable<TrelloChecklist[]> {
    const url = `${TRELLO_API}/1/cards/${cardId}/checklists`;
    return this.callAPI<TrelloChecklist[]>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((checklists) => {
        if (checklists && checklists.length > 0) {
          const cacheDate = new Date();
          checklists.forEach((c) => {
            this.state.checklistCache[c.id] = { item: c, timestamp: cacheDate };
          });
        }
      })
    );
  }

  getChecklist(checklistId: string, bypassCache = false): Observable<TrelloChecklist> {
    this.log('TrelloAPI.getChecklist', '');
    const cached = this.checkCache(this.state.checklistCache, checklistId, bypassCache, 60000);
    if (!cached) {
      return this._getChecklist(checklistId);
    }
    this.log('TrelloAPI.getChecklist', '-> Returning cached value.');
    return of(cached);
  }

  private _getChecklist(checklistId: string): Observable<TrelloChecklist> {
    const url = `${TRELLO_API}/1/checklists/${checklistId}`;
    return this.callAPI<TrelloChecklist>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((checklists) => {
        if (checklists) {
          this.state.checklistCache[checklistId] = { item: checklists, timestamp: new Date() };
        }
      })
    );
  }

  /**
   * Add a new comment to a card.
   */
  addCommentToCard(cardId: string, content: string): Observable<AjaxResponse<TrelloAction>> {
    this.log('TrelloAPI.addCommentToCard', '');
    const url = `${TRELLO_API}/1/cards/${cardId}/actions/comments?text=${encodeURIComponent(content)}`;
    return this.callAPI<TrelloAction>({ url, method: 'POST', crossDomain: true }).pipe();
  }

  /**
   * Add new card
   */
  addNewCard(request: NewCardRequest): Observable<AjaxResponse<TrelloCard>> {
    this.log('TrelloAPI.addNewCard', '');
    let url = `${TRELLO_API}/1/cards`;
    // Add parameters
    url = this.addQueryParam(url, 'idList', request.idList);
    url = this.addQueryParam(url, 'name', request.name, true);
    url = this.addQueryParam(url, 'desc', request.desc, true);
    url = this.addQueryParam(url, 'pos', request.pos);
    url = this.addQueryParam(url, 'idLabels', request.idLabels ? request.idLabels.join(',') : undefined);
    return this.callAPI<TrelloCard>({ url, method: 'POST', crossDomain: true }).pipe();
  }

  /**
   * Update the list on a card by card and list id
   */
  updateCardList(cardId: string, idList: string, position: CardPosition = CardPosition.Top): Observable<TrelloCard> {
    this.log('TrelloAPI.updateCardList', '');
    return this.updateCard({ id: cardId, idList, pos: position });
  }

  /**
   * Check/uncheck a checkItem
   */
  updateCheckItemState(cardId: string, checkItemId: string, state: TrelloCheckItemState): Observable<TrelloCheckItem> {
    this.log('TrelloAPI.updateCheckItemState', '');
    return this.updateCheckItem(cardId, { id: checkItemId, state });
  }

  /**
   * General card update method. Should only be used internally.
   * All updates should be proxied through individual methods.
   */
  private updateCard(updatedCard: Partial<TrelloCard> & { id: string }): Observable<TrelloCard> {
    this.log('TrelloAPI.updateCard', '');
    let url = `${TRELLO_API}/1/cards/${updatedCard.id}`;
    // Add parameters. Only some properties can be updated here.
    url = this.addQueryParam(url, 'name', updatedCard.name, true);
    url = this.addQueryParam(url, 'desc', updatedCard.desc, true);
    url = this.addQueryParam(url, 'idBoard', updatedCard.idBoard);
    url = this.addQueryParam(url, 'idList', updatedCard.idList);
    url = this.addQueryParam(url, 'due', updatedCard.due);
    url = this.addQueryParam(url, 'idAttachmentCover', updatedCard.idAttachmentCover);
    if (updatedCard.idLabels) {
      url = this.addQueryParam(url, 'idLabels', updatedCard.idLabels.join(','));
    }
    if (updatedCard.dueComplete !== undefined) {
      url = this.addQueryParam(url, 'dueComplete', updatedCard.dueComplete.toString());
    }

    return this.callAPI<TrelloCard>({ url, method: 'PUT', crossDomain: true }).pipe(map((resp) => resp.response));
  }

  /**
   * General checkItem update method. Should only be used internally.
   * All updates should be proxied through individual methods.
   */
  private updateCheckItem(
    cardId: string,
    updatedCheckItem: Partial<TrelloCheckItem> & { id: string }
  ): Observable<TrelloCheckItem> {
    this.log('TrelloAPI.updateCheckItem', '');
    let url = `${TRELLO_API}/1/cards/${cardId}/checkItem/${updatedCheckItem.id}`;
    // Add parameters. Only some properties can be updated here.
    url = this.addQueryParam(url, 'name', updatedCheckItem.name, true);
    url = this.addQueryParam(url, 'state', updatedCheckItem.state, true);
    url = this.addQueryParam(url, 'idChecklist', updatedCheckItem.idChecklist);

    return this.callAPI<TrelloCheckItem>({ url, method: 'PUT', crossDomain: true }).pipe(map((resp) => resp.response));
  }

  /**
   * Checks the given cache for an item. Returns null
   * if the item is not found or if the cache is being
   * bypassed or if it is expired. Otherwise, returns the item.
   */
  checkCache<T>(cache: TrelloItemCache<T>, itemId: string, bypassCache: boolean, cacheExpireMs: number): T | null {
    const cached = cache[itemId];
    if (!cached || bypassCache || new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs) {
      null;
    }
    return cached.item;
  }

  /**
   * Throws an error if there's no token. Applies auth to the URL.
   */
  callAPI<T>(config: AjaxConfig): Observable<AjaxResponse<T>> {
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    config.url = this.auth(config.url);
    return this.ajax<T>(config).pipe(catchError((err) => this.handleAPIError(err)));
  }

  /**
   * Add the API key and token query params to a given call.
   */
  private auth(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}key=${TRELLO_API_KEY}&token=${this.token.value}`;
  }

  private addQueryParam(url: string, key: string, value: string | null | undefined, encode = false) {
    if (value) {
      return `${url}${url.includes('?') ? '&' : '?'}${key}=${encode ? encodeURIComponent(value) : value}`;
    }
    return url;
  }

  private handleAPIError(err: any): Observable<never> {
    return throwError(() => {
      if (err instanceof AjaxError) {
        switch (err.status) {
          case 401:
            return PluginError.Unauthorized;
          case 429:
            return PluginError.RateLimit;
          default:
            return PluginError.Unknown;
        }
      } else {
        return PluginError.Unknown;
      }
    });
  }
}
