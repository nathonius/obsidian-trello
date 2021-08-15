import { FileView, Notice, Plugin } from 'obsidian';
import { Subject } from 'rxjs';
import { take, map, concatMap } from 'rxjs/operators';
import { TrelloAPI } from './api';
import { DEFAULT_DATA } from './constants';
import { MetaEditApi, PluginData } from './interfaces';

import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal } from './suggest';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardSuggestModal = new CardSuggestModal(this.app);

  // TODO: Handle no token
  async onload(): Promise<void> {
    // DEV ONLY
    // this.saveData(DEFAULT_DATA);

    const savedData: PluginData | undefined = await this.loadData();
    this.state = new PluginState(this, savedData || DEFAULT_DATA);
    this.api = new TrelloAPI(this);

    // Add settings
    this.addSettingTab(new TrelloSettings(this.app, this));

    this.addCommand({
      id: 'trello-plugin-connect-card',
      name: 'Connect Trello Card',
      callback: () => {
        const view = this.app.workspace.activeLeaf?.view;
        if (view instanceof FileView) {
          this.state.settings
            .pipe(
              take(1),
              map((s) => s.selectedBoards),
              concatMap((boards) => {
                this.boardSuggestModal.boards = boards;
                this.boardSuggestModal.open();
                return this.boardSuggestModal.selectedBoard;
              }),
              take(1),
              concatMap((selected) => this.api.getCardsFromBoard(selected.id)),
              map((resp) => resp.response),
              concatMap((cards) => {
                this.cardSuggestModal.cards = cards;
                this.cardSuggestModal.open();
                return this.cardSuggestModal.selectedCard;
              })
            )
            .subscribe((selected) => {
              console.log(selected);
            });
        }
      }
    });
  }

  onunload() {
    this.destroy.next();
    this.destroy.complete();
  }

  get metaEdit(): MetaEditApi | null {
    if ((this.app as any).plugins['metaedit']) {
      return (this.app as any).plugins['metaedit'].api;
    }
    new Notice('Obsidian Trello requires the MetaEdit plugin.');
    return null;
  }
}
