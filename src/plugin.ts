import { FileView, Notice, Plugin, TFile } from 'obsidian';
import { concat, forkJoin, from, Observable, pipe, Subject } from 'rxjs';
import { take, map, concatMap, concatMapTo } from 'rxjs/operators';
import { TrelloAPI } from './api';
import { DEFAULT_DATA, MetaKey } from './constants';
import { MetaEditApi, PluginData, TrelloCard } from './interfaces';

import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal } from './suggest';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  readonly cardCache: Record<string, { card: TrelloCard; timestamp: Date }> =
    {};

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

        if (view instanceof FileView && this.metaEditAvailable) {
          forkJoin([
            this.state.settings.pipe(
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
              }),
              take(1)
            ),

            from(this.metaEdit.getPropertyValue(MetaKey.Board, view.file)),
            from(this.metaEdit.getPropertyValue(MetaKey.Card, view.file))
          ]).subscribe(([selected, boardId, cardId]) => {
            console.log(selected);

            // NOTE TO FUTURE NATHAN
            // these two calls to update/createYamlProperty are clobbering each other
            // I think that's why they are not working
            // just need to combine these into a pipe or something

            // Add IDs to file
            if (boardId) {
              this.metaEdit.update(MetaKey.Board, selected.idBoard, view.file);
            } else {
              this.metaEdit.createYamlProperty(
                MetaKey.Board,
                selected.idBoard,
                view.file
              );
            }
            if (cardId) {
              this.metaEdit.update(MetaKey.Card, selected.id, view.file);
            } else {
              this.metaEdit.createYamlProperty(
                MetaKey.Card,
                selected.id,
                view.file
              );
            }
          });
        }
      }
    });
  }

  onunload() {
    this.destroy.next();
    this.destroy.complete();
  }

  get metaEditAvailable(): boolean {
    const available = !!(this.app as any).plugins.plugins['metaedit'];
    if (!available) {
      new Notice('Obsidian Trello requires the MetaEdit plugin.');
    }
    return available;
  }

  get metaEdit(): MetaEditApi {
    return (this.app as any).plugins.plugins['metaedit'].api;
  }
}
