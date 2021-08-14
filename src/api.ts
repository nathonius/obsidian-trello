import { TRELLO_API, TRELLO_API_KEY } from './constants';

export class TrelloApiService {
  constructor(private token: string) {}

  getBoards(): Promise<Response> {
    const url = `${TRELLO_API}/1/members/me/boards?fields=name,url&key=${TRELLO_API_KEY}&token=${this.token}`;
    return window.fetch(url);
  }
}
