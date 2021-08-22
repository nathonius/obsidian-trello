import { BehaviorSubject, Observable, of } from 'rxjs';
import { ajax, AjaxResponse } from 'rxjs/ajax';
import { map, takeUntil, tap } from 'rxjs/operators';
import { TRELLO_API, TRELLO_API_KEY } from './constants';
import {
  TrelloAction,
  TrelloActionType,
  TrelloBoard,
  TrelloCard,
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

  getBoards(): Observable<AjaxResponse<TrelloBoard[]>> {
    const url = this.auth(`${TRELLO_API}/1/members/me/boards?fields=name,url`);
    return ajax<TrelloBoard[]>({ url, crossDomain: true });
  }

  getCardFromBoard(
    boardId: string,
    cardId: string,
    bypassCache = false,
    cacheExpireMs = 60000 // 1 minute
  ): Observable<TrelloCard> {
    const cached = this.plugin.cardCache[cardId];
    if (
      !cached ||
      bypassCache ||
      new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs
    ) {
      return this._getCardFromBoard(boardId, cardId);
    }
    return of(cached.item);
  }

  private _getCardFromBoard(
    boardId: string,
    cardId: string
  ): Observable<TrelloCard> {
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/cards/${cardId}`);
    return ajax<TrelloCard>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((card) => {
        this.plugin.cardCache[card.id] = {
          item: card,
          timestamp: new Date()
        };
      })
    );
  }

  getList(
    listId: string,
    bypassCache = false,
    cacheExpireMs = 600000 // 10 minutes
  ): Observable<TrelloList> {
    const cached = this.plugin.listCache[listId];
    if (
      !cached ||
      bypassCache ||
      new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs
    ) {
      return this._getList(listId);
    }
    return of(cached.item);
  }

  private _getList(listId: string): Observable<TrelloList> {
    const url = this.auth(`${TRELLO_API}/1/lists/${listId}`);
    return ajax<TrelloList>({ url, crossDomain: true }).pipe(
      map((resp) => resp.response),
      tap((list) => {
        this.plugin.listCache[list.id] = { item: list, timestamp: new Date() };
      })
    );
  }

  getCardsFromBoard(boardId: string): Observable<AjaxResponse<TrelloCard[]>> {
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/cards`);
    return ajax<TrelloCard[]>({ url, crossDomain: true }).pipe(
      tap((resp) => {
        const cards = resp.response;
        cards.forEach((card) => {
          this.plugin.cardCache[card.id] = {
            item: card,
            timestamp: new Date()
          };
        });
      })
    );
  }

  getActionsFromCard(
    cardId: string,
    actionTypes: string[] = [TrelloActionType.Comment],
    bypassCache = false,
    cacheExpireMs = 60000 // 1 minute
  ): Observable<TrelloAction[]> {
    const cached = this.plugin.cardActionsCache[cardId];
    if (
      !cached ||
      bypassCache ||
      new Date().getTime() - cached.timestamp.getTime() > cacheExpireMs
    ) {
      return this._getActionsFromCard(cardId, actionTypes).pipe(
        map((resp) => resp.response)
      );
    }
    return of(cached.item);
  }

  private _getActionsFromCard(
    cardId: string,
    actionTypes: string[] = [TrelloActionType.Comment]
  ): Observable<AjaxResponse<TrelloAction[]>> {
    const url = this.auth(
      `${TRELLO_API}/1/cards/${cardId}/actions?filter=${actionTypes.join(',')}`
    );
    return ajax<TrelloAction[]>({ url, crossDomain: true });
  }

  addCommentToCard(
    cardId: string,
    content: string
  ): Observable<AjaxResponse<TrelloAction>> {
    const url = this.auth(
      `${TRELLO_API}/1/cards/${cardId}/actions/comments?text=${encodeURIComponent(
        content
      )}`
    );
    return ajax<TrelloAction>({ url, method: 'POST', crossDomain: true });
  }

  private auth(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}key=${TRELLO_API_KEY}&token=${
      this.token.value
    }`;
  }
}
