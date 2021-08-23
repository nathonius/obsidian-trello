import { FileView, Notice, Plugin, addIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { BehaviorSubject, concat, forkJoin, from, iif, Observable, of, Subject } from 'rxjs';
import { take, map, concatMap, tap, finalize, takeUntil } from 'rxjs/operators';
import { TrelloAPI } from './api';
import { CUSTOM_ICONS, DEFAULT_DATA, MetaKey, TRELLO_ERRORS, TRELLO_VIEW_TYPE } from './constants';
import {
  LeafSide,
  MetaEditApi,
  PluginData,
  PluginError,
  TrelloAction,
  TrelloCard,
  TrelloItemCache,
  TrelloList
} from './interfaces';

import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal } from './suggest';
import { TrelloView } from './view/view';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  view!: TrelloView;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  readonly cardCache: TrelloItemCache<TrelloCard> = {};
  readonly cardActionsCache: TrelloItemCache<TrelloAction[]> = {};
  readonly listCache: TrelloItemCache<TrelloList> = {};
  readonly boardCardId = new BehaviorSubject<string | null>(null);
  readonly currentToken = new BehaviorSubject<string>('');

  get metaEditAvailable(): boolean {
    const available = !!(this.app as any).plugins.plugins['metaedit'];
    if (!available) {
      new Notice(TRELLO_ERRORS.metaEdit);
    }
    return available;
  }

  get metaEdit(): MetaEditApi {
    return {
      ...(this.app as any).plugins.plugins['metaedit'].api,
      deleteProperty: this.deleteProperty.bind(this)
    };
  }

  async onload(): Promise<void> {
    // Set up data and default data.
    const savedData: PluginData | undefined = await this.loadData();
    this.state = new PluginState(this, savedData || DEFAULT_DATA);

    // Create new API instance
    this.api = new TrelloAPI(this);

    // Add custom icon(s)
    addIcon(CUSTOM_ICONS.trello.id, CUSTOM_ICONS.trello.svgContent);

    // Future: Execute version migrations
    // if (savedData && savedData.version !== DEFAULT_DATA.version) {
    // }

    // Need token synchronously to help handle errors
    this.state.settings
      .pipe(
        takeUntil(this.destroy),
        map((s) => s.token)
      )
      .subscribe((token) => {
        this.currentToken.next(token);

        if (token) {
          this.handleFile(this.app.workspace.getActiveFile());
        }
      });

    // Register trello view type
    this.registerView(TRELLO_VIEW_TYPE, (leaf: WorkspaceLeaf) => (this.view = new TrelloView(this, leaf)));

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

  /**
   * Open the settings modal to the trello tab
   */
  openTrelloSettings() {
    (this.app as any).setting.openTabById('obsidian-trello');
    (this.app as any).setting.open();
  }

  /**
   * Called on new file being opened. Informs the view of the current card.
   */
  private async handleFile(file: TFile | null): Promise<void> {
    // See if we need to do anything
    if (!file || !this.metaEditAvailable) {
      return;
    }
    const existing = await this.metaEdit.getPropertyValue(MetaKey.BoardCard, file);
    if (!existing) {
      this.boardCardId.next(null);
      return;
    }

    // This file is trello connected
    this.boardCardId.next(existing);
  }

  /**
   * Add or update a frontmatter key to a given file
   * Make sure not to call this multiple times in a row,
   * updates can get clobbered.
   */
  private updateOrCreateMeta(key: string, value: string, file: TFile): Observable<void> {
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
          // If boards were selected, use those. Otherwise, call API.
          concatMap((boards) => iif(() => boards.length > 0, of(boards), this.api.getBoards())),
          // Open board suggestion modal
          concatMap((boards) => {
            this.boardSuggestModal.boards = boards;
            this.boardSuggestModal.open();
            return this.boardSuggestModal.selectedBoard;
          }),
          take(1),
          // Get available cards from selected board
          concatMap((selected) => this.api.getCardsFromBoard(selected.id)),
          // Open card suggestion modal
          concatMap((cards) => {
            this.cardSuggestModal.cards = cards;
            this.cardSuggestModal.open();
            return this.cardSuggestModal.selectedCard;
          }),
          take(1),
          map((selected) => `${selected.idBoard};${selected.id}`),
          tap((boardCardId) => {
            this.boardCardId.next(boardCardId);
          }),
          concatMap((boardCardId) => this.updateOrCreateMeta(MetaKey.BoardCard, boardCardId, view.file))
        )
        .subscribe({
          next: () => {
            this.revealTrelloLeaf(true);
          }
        });
    }
  }

  /**
   * Removes the trello frontmatter property from the current file.
   */
  disconnectTrelloCard(): void {
    const view = this.app.workspace.activeLeaf?.view;

    if (view instanceof FileView && this.metaEditAvailable) {
      from(this.metaEdit.getPropertyValue(MetaKey.BoardCard, view.file)).subscribe((existing) => {
        if (existing) {
          this.metaEdit.deleteProperty(MetaKey.BoardCard, view.file);
          this.boardCardId.next(null);
        }
      });
    }
  }

  /**
   * Adds the trello leaf if not already available
   * @param activate if true, reveal the leaf, if false it will only be added
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
            side === LeafSide.Right ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeftLeaf(false);
          leaf.setViewState({ type: TRELLO_VIEW_TYPE });
          if (activate) {
            this.app.workspace.revealLeaf(leaf);
          }
        });
    } else if (activate) {
      this.app.workspace.revealLeaf(leaves[0]);
    }
  }

  // From https://github.com/chhoumann/MetaEdit/blob/master/src/metaController.ts
  private async deleteProperty(property: string, file: TFile): Promise<void> {
    if (file) {
      const fileContent = await this.app.vault.read(file);
      const splitContent = fileContent.split('\n');
      const regexp = new RegExp(`^\s*${property}:`);

      const idx = splitContent.findIndex((s) => s.match(regexp));
      const newFileContent = splitContent
        .filter((_, i) => {
          if (i != idx) return true;
        })
        .join('\n');

      await this.app.vault.modify(file, newFileContent);
    }
  }
}
