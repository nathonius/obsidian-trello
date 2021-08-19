import { BehaviorSubject, Observable, of } from 'rxjs';
import { ajax, AjaxResponse } from 'rxjs/ajax';
import { map, takeUntil, tap } from 'rxjs/operators';
import { TRELLO_API, TRELLO_API_KEY } from './constants';
import { TrelloBoard, TrelloCard } from './interfaces';
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
    const now = new Date();
    if (
      !cached ||
      bypassCache ||
      now.getTime() - cached.timestamp.getTime() > cacheExpireMs
    ) {
      return this._getCardFromBoard(boardId, cardId);
    }
    return of(cached.card);
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
          card,
          timestamp: new Date()
        };
      })
    );
  }

  getCardsFromBoard(boardId: string): Observable<AjaxResponse<TrelloCard[]>> {
    const url = this.auth(`${TRELLO_API}/1/boards/${boardId}/cards`);
    return ajax<TrelloCard[]>({ url, crossDomain: true }).pipe(
      tap((resp) => {
        const cards = resp.response;
        cards.forEach((card) => {
          this.plugin.cardCache[card.id] = { card, timestamp: new Date() };
        });
      })
    );
  }

  private auth(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}key=${TRELLO_API_KEY}&token=${
      this.token.value
    }`;
  }
}
