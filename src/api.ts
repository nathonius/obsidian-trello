import { BehaviorSubject } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { map, takeUntil } from 'rxjs/operators';
import { TRELLO_API, TRELLO_API_KEY } from './constants';
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

  getBoards() {
    const url = `${TRELLO_API}/1/members/me/boards?fields=name,url&key=${TRELLO_API_KEY}&token=${this.token.value}`;
    return ajax<any>({ url, crossDomain: true });
  }
}
