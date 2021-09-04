import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { ajax, AjaxError, AjaxResponse } from 'rxjs/ajax';
import { map, takeUntil, tap, catchError } from 'rxjs/operators';
import { TRELLO_API, TRELLO_API_KEY } from './constants';
import {
  CardPosition,
  NewCardRequest,
  PluginError,
  TrelloAction,
  TrelloActionType,
  TrelloBoard,
  TrelloCard,
  TrelloLabel,
  TrelloList
} from './interfaces';
import { TrelloPlugin } from './plugin';

export class TrelloAPI {
  private readonly token = new BehaviorSubject<string>('');

  constructor(private readonly plugin: TrelloPlugin) {
    this.plugin.state.settings
      .pipe(
        takeUntil(this.plugin.destroy),
        map((settings) => settings.token)
      )
      .subscribe(this.token);
  }

  /**
   * Get all boards for current user.
   * This is not cached.
   */
  getBoards(): Observable<TrelloBoard[]> {
    this.plugin.log('API - getBoards');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/members/me/boards?fields=name,url`);
    return ajax<TrelloBoard[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response)
    );
  }

  /**
   * Get a specific card by board and card ID.
   * This uses the cache if possible.
   */
  getCardFromBoard(
    boardId: string,
    cardId: string,
    bypassCache = false,
    cacheExpireMs = 120000 // 2 minutes
  ): Observable<TrelloCard> {
    this.plugin.log('API - getCardFromBoard');
    const cached = this.plugin.state.cardCache[cardId];
    if (!cached || bypassCache || new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs) {
      return this._getCardFromBoard(boardId, cardId);
    }
    this.plugin.log('-> Returning cached value.');
    return of(cached.item);
  }

  /**
   * Get a specific card by board and card ID.
   * Always calls API and updates cache.
   */
  private _getCardFromBoard(boardId: string, cardId: string): Observable<TrelloCard> {
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/cards/${cardId}`);
    return ajax<TrelloCard>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((card) => {
        if (card) {
          this.plugin.state.cardCache[card.id] = {
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
  getLabelsFromBoard(boardId: string, bypassCache = false, cacheExpireMs = 600000): Observable<TrelloLabel[]> {
    this.plugin.log('API - getLabelsFromBoard');
    const cached = this.plugin.state.labelCache[boardId];
    if (!cached || bypassCache || new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs) {
      return this._getLabelsFromBoard(boardId);
    }
    this.plugin.log('-> Returning cached value.');
    return of(cached.item);
  }

  /**
   * Get all labels for a given board.
   * This updates the cache.
   */
  private _getLabelsFromBoard(boardId: string): Observable<TrelloLabel[]> {
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/labels`);
    return ajax<TrelloLabel[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((labels) => {
        this.plugin.state.labelCache[boardId] = { item: labels, timestamp: new Date() };
      })
    );
  }

  /**
   * Get all lists for the given board.
   * This is not cached, but updates the cache.
   */
  getListsFromBoard(boardId: string): Observable<TrelloList[]> {
    this.plugin.log('API - getListsFromBoard');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/lists`);
    return ajax<TrelloList[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((lists) => {
        if (lists && lists.length > 0) {
          lists.forEach((list) => {
            this.plugin.state.listCache[list.id] = { item: list, timestamp: new Date() };
          });
        }
      })
    );
  }

  /**
   * Get a specific list by list ID.
   * This uses cache if possible.
   */
  getList(
    listId: string,
    bypassCache = false,
    cacheExpireMs = 600000 // 10 minutes
  ): Observable<TrelloList> {
    this.plugin.log('API - getList');
    const cached = this.plugin.state.listCache[listId];
    if (!cached || bypassCache || new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs) {
      return this._getList(listId);
    }
    this.plugin.log('-> Returning cached value.');
    return of(cached.item);
  }

  /**
   * Get a specific list by list ID.
   * Always calls API and updates cache.
   */
  private _getList(listId: string): Observable<TrelloList> {
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/lists/${listId}`);
    return ajax<TrelloList>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((list) => {
        if (list) {
          this.plugin.state.listCache[list.id] = { item: list, timestamp: new Date() };
        }
      })
    );
  }

  /**
   * Get all cards from a board by board ID.
   * This always calls the API and updates the cache.
   */
  getCardsFromBoard(boardId: string): Observable<TrelloCard[]> {
    this.plugin.log('API - getCardsFromBoard');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/cards`);
    return ajax<TrelloCard[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((cards) => {
        cards.forEach((card) => {
          this.plugin.state.cardCache[card.id] = {
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
    bypassCache = false,
    cacheExpireMs = 60000 // 1 minute
  ): Observable<TrelloAction[]> {
    this.plugin.log('API - getActionsFromCard');
    const cached = this.plugin.state.cardActionsCache[cardId];
    if (!cached || bypassCache || new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs) {
      return this._getActionsFromCard(cardId, actionTypes);
    }
    this.plugin.log('-> Returning cached value.');
    return of(cached.item);
  }

  /**
   * Get all actions from a card by card ID.
   * Always calls the API and updates the cache.
   */
  private _getActionsFromCard(
    cardId: string,
    actionTypes: string[] = [TrelloActionType.Comment]
  ): Observable<TrelloAction[]> {
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/cards/${cardId}/actions?filter=${actionTypes.join(',')}`);
    return ajax<TrelloAction[]>({ url, crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response),
      tap((actions) => {
        if (actions) {
          this.plugin.state.cardActionsCache[cardId] = { item: actions, timestamp: new Date() };
        }
      })
    );
  }

  /**
   * Add a new comment to a card.
   */
  addCommentToCard(cardId: string, content: string): Observable<AjaxResponse<TrelloAction>> {
    this.plugin.log('API - addCommentToCard');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    const url = this.auth(`${TRELLO_API}/1/cards/${cardId}/actions/comments?text=${encodeURIComponent(content)}`);
    return ajax<TrelloAction>({ url, method: 'POST', crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err))
    );
  }

  /**
   * Add new card
   */
  addNewCard(request: NewCardRequest): Observable<AjaxResponse<TrelloCard>> {
    this.plugin.log('API - addNewCard');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    let url = this.auth(`${TRELLO_API}/1/cards`);
    // Add parameters
    url = this.addQueryParam(url, 'idList', request.idList);
    url = this.addQueryParam(url, 'name', request.name, true);
    url = this.addQueryParam(url, 'desc', request.desc, true);
    url = this.addQueryParam(url, 'pos', request.pos);
    url = this.addQueryParam(url, 'idLabels', request.idLabels ? request.idLabels.join(',') : undefined);
    return ajax<TrelloCard>({ url, method: 'POST', crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err))
    );
  }

  /**
   * Update the list on a card by card and list id
   */
  updateCardList(cardId: string, idList: string, position: CardPosition = CardPosition.Top): Observable<TrelloCard> {
    this.plugin.log('API - updateCardList');
    return this.updateCard({ id: cardId, idList });
  }

  /**
   * General update method. Should only be used internally.
   * All updates should be proxied through individual methods.
   */
  private updateCard(updatedCard: Partial<TrelloCard> & { id: string }): Observable<TrelloCard> {
    this.plugin.log('API - updateCard');
    if (this.token.value === '') {
      return throwError(() => PluginError.NoToken);
    }
    let url = this.auth(`${TRELLO_API}/1/cards/${updatedCard.id}`);
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

    return ajax<TrelloCard>({ url, method: 'PUT', crossDomain: true }).pipe(
      catchError((err) => this.handleAPIError(err)),
      map((resp) => resp.response)
    );
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
