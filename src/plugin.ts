import { FileView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import {
  BehaviorSubject,
  concat,
  forkJoin,
  from,
  Observable,
  pipe,
  Subject
} from 'rxjs';
import { take, map, concatMap, concatMapTo, delay } from 'rxjs/operators';
import { TrelloAPI } from './api';
import { DEFAULT_DATA, MetaKey, TRELLO_VIEW_TYPE } from './constants';
import { MetaEditApi, PluginData, TrelloCard } from './interfaces';

import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal } from './suggest';
import { TrelloView } from './view';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  destroy = new Subject<void>();
  view!: TrelloView;
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  readonly cardCache: Record<string, { card: TrelloCard; timestamp: Date }> =
    {};
  readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);

  // TODO: Handle no token
  async onload(): Promise<void> {
    // DEV ONLY
    // this.saveData(DEFAULT_DATA);

    const savedData: PluginData | undefined = await this.loadData();
    this.state = new PluginState(this, savedData || DEFAULT_DATA);
    this.api = new TrelloAPI(this);

    this.registerView(
      TRELLO_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => (this.view = new TrelloView(this, leaf))
    );

    this.app.workspace.on('file-open', async (file) => {
      // See if we need to do anything
      if (!file || !this.metaEditAvailable) {
        return;
      }
      const existing = await this.metaEdit.getPropertyValue(
        MetaKey.BoardCard,
        file
      );
      if (!existing) {
        this.currentCard.next(null);
        return;
      }

      // This file is trello connected
      const [boardId, cardId] = existing.split(';');
      this.api.getCardFromBoard(boardId, cardId).subscribe((card) => {
        this.currentCard.next(card);
      });
    });

    this.addCommand({
      id: 'trello-plugin-leaf-test',
      name: 'Trello Leaf Test',
      callback: () => {
        let leaves = this.app.workspace.getLeavesOfType(TRELLO_VIEW_TYPE);
        if (leaves.length === 0) {
          const rightLeaf = this.app.workspace.getRightLeaf(false);
          rightLeaf.setViewState({ type: TRELLO_VIEW_TYPE, active: true });
        }
      }
    });

    // Add settings
    this.addSettingTab(new TrelloSettings(this.app, this));

    this.addCommand({
      id: 'trello-plugin-connect-card',
      name: 'Connect Trello Card',
      callback: () => {
        const view = this.app.workspace.activeLeaf?.view;

        if (view instanceof FileView && this.metaEditAvailable) {
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
              }),
              take(1),
              concatMap((selected) =>
                this.updateOrCreateMeta(
                  MetaKey.BoardCard,
                  `${selected.idBoard};${selected.id}`,
                  view.file
                )
              )
            )
            .subscribe();
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

  private updateOrCreateMeta(
    key: string,
    value: string,
    file: TFile
  ): Observable<void> {
    return from(this.metaEdit.getPropertyValue(key, file)).pipe(
      concatMap((existing) => {
        if (existing) {
          return from(this.metaEdit.update(key, value, file));
        } else {
          return from(this.metaEdit.createYamlProperty(key, value, file));
        }
      })
    );
  }
}
