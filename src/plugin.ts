import {
  FileView,
  Notice,
  Plugin,
  addIcon,
  TFile,
  WorkspaceLeaf
} from 'obsidian';
import { BehaviorSubject, from, Observable, Subject } from 'rxjs';
import { take, map, concatMap, tap, finalize } from 'rxjs/operators';
import { TrelloAPI } from './api';
import {
  CUSTOM_ICONS,
  DEFAULT_DATA,
  MetaKey,
  TRELLO_VIEW_TYPE
} from './constants';
import {
  LeafSide,
  MetaEditApi,
  PluginData,
  TrelloAction,
  TrelloCard,
  TrelloItemCache,
  TrelloList
} from './interfaces';

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
  readonly cardCache: TrelloItemCache<TrelloCard> = {};
  readonly cardActionsCache: TrelloItemCache<TrelloAction[]> = {};
  readonly listCache: TrelloItemCache<TrelloList> = {};
  readonly currentCard = new BehaviorSubject<TrelloCard | null>(null);

  // TODO: Handle no token
  async onload(): Promise<void> {
    // DEV ONLY
    // this.saveData(DEFAULT_DATA);
    this.addRibbonIcon('trash', 'test', () => {});
    this.addRibbonIcon('undo-glyph', 'test2', () => {});
    this.addRibbonIcon('reset', 'test3', () => {});

    // Set up data and default data.
    const savedData: PluginData | undefined = await this.loadData();
    this.state = new PluginState(this, savedData || DEFAULT_DATA);
    this.api = new TrelloAPI(this);
    this.addIcons();

    // Register trello view type
    this.registerView(
      TRELLO_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => (this.view = new TrelloView(this, leaf))
    );

    // Register file handler to check if the opened card is trello connected
    this.app.workspace.on('file-open', async (file) => this.handleFile(file));
    // Also check the current file on load
    this.handleFile(this.app.workspace.getActiveFile());

    // Add settings
    this.addSettingTab(new TrelloSettings(this.app, this));

    // Add commands
    this.addCommand({
      id: 'trello-plugin-connect-card',
      name: 'Connect Trello card',
      callback: this.connectTrelloCard.bind(this),
      icon: 'link'
    });

    this.addCommand({
      id: 'trello-plugin-disconnect-card',
      name: 'Disconnect Trello card',
      callback: this.disconnectTrelloCard.bind(this),
      icon: 'trash'
    });

    this.addCommand({
      id: 'trello-plugin-reveal-leaf',
      name: 'Show Trello view',
      callback: () => {
        this.revealTrelloLeaf(true);
      },
      icon: CUSTOM_ICONS.trello.id
    });
  }

  onunload() {
    // Unsubscribe long-lived listeners
    this.destroy.next();
    this.destroy.complete();

    // Remove trello leaf
    this.app.workspace.detachLeavesOfType(TRELLO_VIEW_TYPE);
  }

  get metaEditAvailable(): boolean {
    const available = !!(this.app as any).plugins.plugins['metaedit'];
    if (!available) {
      new Notice('Obsidian Trello requires the MetaEdit plugin.');
    }
    return available;
  }

  get metaEdit(): MetaEditApi {
    return {
      ...(this.app as any).plugins.plugins['metaedit'].api,
      deleteProperty: this.deleteProperty.bind(this)
    };
  }

  private async handleFile(file: TFile | null): Promise<void> {
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
  }

  /**
   * Add or update a frontmatter key to a given file
   * Make sure not to call this multiple times in a row,
   * updates can get clobbered.
   */
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

  /**
   * Opens multiple suggest modals to select first a trello board and then a trello card
   * Adds the board and card IDs to the frontmatter of the note, then reveals the leaf
   */
  connectTrelloCard(): void {
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
          tap((selected) => {
            this.currentCard.next(selected);
          }),
          concatMap((selected) =>
            this.updateOrCreateMeta(
              MetaKey.BoardCard,
              `${selected.idBoard};${selected.id}`,
              view.file
            )
          )
        )
        .subscribe(() => {
          this.revealTrelloLeaf(true);
        });
    }
  }

  disconnectTrelloCard(): void {
    const view = this.app.workspace.activeLeaf?.view;

    if (view instanceof FileView && this.metaEditAvailable) {
      from(
        this.metaEdit.getPropertyValue(MetaKey.BoardCard, view.file)
      ).subscribe((existing) => {
        if (existing) {
          this.metaEdit.deleteProperty(MetaKey.BoardCard, view.file);
          this.currentCard.next(null);
        }
      });
    }
  }

  /**
   * Adds the trello leaf if not already available
   * @param activate if true, reveal the leaf
   */
  private revealTrelloLeaf(activate = false): void {
    const leaves = this.app.workspace.getLeavesOfType(TRELLO_VIEW_TYPE);

    if (leaves.length === 0) {
      this.state.settings
        .pipe(
          take(1),
          map((s) => s.openToSide)
        )
        .subscribe((side) => {
          const leaf =
            side === LeafSide.Right
              ? this.app.workspace.getRightLeaf(false)
              : this.app.workspace.getLeftLeaf(false);
          leaf.setViewState({ type: TRELLO_VIEW_TYPE });
          if (activate) {
            this.app.workspace.revealLeaf(leaf);
          }
        });
    } else if (activate) {
      this.app.workspace.revealLeaf(leaves[0]);
    }
  }

  private addIcons(): void {
    addIcon(CUSTOM_ICONS.trello.id, CUSTOM_ICONS.trello.svgContent);
  }

  // From https://github.com/chhoumann/MetaEdit/blob/master/src/metaController.ts
  private async deleteProperty(property: string, file: TFile): Promise<void> {
    if (file) {
      const fileContent = await this.app.vault.read(file);
      const splitContent = fileContent.split('\n');
      const regexp = new RegExp(`^\s*${property}:`);

      const idx = splitContent.findIndex((s) => s.match(regexp));
      const newFileContent = splitContent
        .filter((v, i) => {
          if (i != idx) return true;
        })
        .join('\n');

      await this.app.vault.modify(file, newFileContent);
    }
  }
}
