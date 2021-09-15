import { FileView, Notice, Plugin, addIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { forkJoin, from, iif, Observable, of, Subject } from 'rxjs';
import { take, map, concatMap, tap, takeUntil } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import {
  CUSTOM_ICONS,
  DEFAULT_DATA,
  DEFAULT_SETTINGS,
  LogLevel,
  METAEDIT_DEBOUNCE,
  MetaKey,
  NEW_TRELLO_CARD,
  TRELLO_ERRORS,
  TRELLO_VIEW_TYPE
} from './constants';
import { LeafSide, MetaEditApi, PluginData, PluginError, TrelloBoard, TrelloCard } from './interfaces';
import { TrelloAPI } from './api';
import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal, CardCreateModal, ListSuggestModal, CustomizeUIModal } from './modal';
import { TrelloView } from './view/view';
import { migrations } from './migrations';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  view!: TrelloView;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardCreateModal = new CardCreateModal(this.app, this);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  customizeUIModal!: CustomizeUIModal;
  readonly listSuggestModal = new ListSuggestModal(this.app);

  get metaEditAvailable(): boolean {
    const available = !!(this.app as any).plugins.plugins['metaedit'];
    if (!available) {
      this.log('MetaEdit not available.', LogLevel.Error);
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
    const data: PluginData = Object.assign({}, DEFAULT_DATA, savedData);
    data.settings = Object.assign({}, DEFAULT_SETTINGS, savedData?.settings);
    data.settings.customUi = Object.assign({}, DEFAULT_SETTINGS.customUi, savedData?.settings.customUi);
    this.state = new PluginState(this, data);

    // Create new API instance
    this.api = new TrelloAPI(this);

    // Configure custom UI modal
    this.customizeUIModal = new CustomizeUIModal(this.app, this);

    // Add custom icon(s)
    addIcon(CUSTOM_ICONS.trello.id, CUSTOM_ICONS.trello.svgContent);

    // Execute version migrations
    if (savedData && savedData.version !== DEFAULT_DATA.version) {
      migrations[savedData.version](this);
    }

    // Need some settings synchronously
    this.state.settings.pipe(takeUntil(this.destroy)).subscribe((settings) => {
      this.state.currentToken.next(settings.token);
      this.state.verboseLogging.next(settings.verboseLogging);
    });

    // Register trello view type
    this.registerView(TRELLO_VIEW_TYPE, (leaf: WorkspaceLeaf) => (this.view = new TrelloView(this, leaf)));

    // Register file handler to check if the opened card is trello connected\
    this.registerEvent(this.app.workspace.on('file-open', async (file) => this.handleFile(file)));
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

    // If this is the first run, add the trello pane.
    if (data.firstRun) {
      this.revealTrelloLeaf(true);
      this.state.completedFirstRun();
    }
  }

  onunload(): void {
    // Unsubscribe long-lived listeners
    this.destroy.next();
    this.destroy.complete();

    // Remove trello leaf
    this.app.workspace.detachLeavesOfType(TRELLO_VIEW_TYPE);
  }

  /**
   * Open the settings modal to the trello tab
   */
  openTrelloSettings(): void {
    this.log('Opening settings');
    (this.app as any).setting.openTabById('obsidian-trello');
    (this.app as any).setting.open();
  }

  log(message: string, logLevel: LogLevel = LogLevel.Info): void {
    if (this.state.verboseLogging.value) {
      const log = `OBISIDAN-TRELLO: ${message}`;
      switch (logLevel) {
        case LogLevel.Warn:
          console.warn(log);
          break;
        case LogLevel.Error:
          console.error(log);
          break;
        case LogLevel.Info:
        default:
          console.log(log);
          break;
      }
    }
  }

  /**
   * Called on new file being opened. Informs the view of the current card.
   */
  private async handleFile(file: TFile | null): Promise<void> {
    // See if we need to do anything
    if (!file || !this.metaEditAvailable) {
      return;
    }

    let id = await this.metaEdit.getPropertyValue(MetaKey.TrelloId, file);

    if (!id) {
      const deprecatedId = await this.metaEdit.getPropertyValue(MetaKey.BoardCard, file);
      if (deprecatedId) {
        // Migrate old board/card ID to new ID
        const newId = uuid();
        const [boardId, cardId] = deprecatedId.split(';');
        await this.metaEdit.deleteProperty(MetaKey.BoardCard, file);
        await new Promise((resolve) => window.setTimeout(resolve, METAEDIT_DEBOUNCE));
        await this.metaEdit.createYamlProperty(MetaKey.TrelloId, newId, file);
        await new Promise((resolve) => window.setTimeout(resolve, METAEDIT_DEBOUNCE));
        this.state.updateConnectedCard(newId, { boardId, cardId });
        id = newId;
      }
    }

    if (!id) {
      this.log('File not trello connected');
      this.state.connectedCardId.next(null);
      return;
    }

    // This file is trello connected
    this.log(`File trello connected, board/card ID ${id}`);
    this.state.connectedCardId.next(id);
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

    // Might need this later
    let board: TrelloBoard;

    if (view instanceof FileView && this.metaEditAvailable) {
      this.log('Connecting trello card');
      this.state.settings
        .pipe(
          take(1),
          map((s) => s.selectedBoards),
          // If boards were selected, use those. Otherwise, call API.
          concatMap((boards) => iif(() => boards.length > 0, of(boards), this.api.getBoards())),
          tap(() => {
            this.log('-> Got boards');
          }),
          // Open board suggestion modal
          concatMap((boards) => this.selectBoard(boards)),
          tap((selectedBoard) => {
            this.log(`-> Selected board ${selectedBoard.id}`);
            board = selectedBoard;
          }),
          // Get available cards from selected board
          concatMap((selectedBoard) => this.api.getCardsFromBoard(selectedBoard.id)),
          tap((cards) => {
            this.log(`-> Got ${cards.length} cards.`);
          }),
          // Open card suggestion modal
          concatMap((cards: TrelloCard[]) => this.selectCard(cards)),
          tap((selectedCard: TrelloCard) => {
            this.log(`-> Selected card ${selectedCard.id}`);
          }),
          concatMap((selectedCard: TrelloCard) =>
            iif(() => selectedCard === NEW_TRELLO_CARD, this.addNewCard(board), of(selectedCard))
          ),
          concatMap((selectedCard: TrelloCard) =>
            forkJoin({
              selectedCard: of(selectedCard),
              existingId: from(this.metaEdit.getPropertyValue(MetaKey.TrelloId, view.file))
            })
          ),
          map(({ selectedCard, existingId }: { selectedCard: TrelloCard; existingId: string | undefined }) => {
            const trelloId = existingId ? existingId : uuid();
            this.log(`-> Updating file with board/card ID ${selectedCard.idBoard}/${selectedCard.id}`);
            this.state.updateConnectedCard(trelloId, { cardId: selectedCard.id, boardId: selectedCard.idBoard });
            this.state.connectedCardId.next(trelloId);
            return trelloId;
          }),
          concatMap((trelloId: string) => this.updateOrCreateMeta(MetaKey.TrelloId, trelloId, view.file))
        )
        .subscribe({
          next: () => {
            this.revealTrelloLeaf(true);
          },
          error: (err) => {
            if (err === PluginError.Abort) {
              this.log('-> Aborting connect flow.');
            } else if (err === PluginError.Unauthorized) {
              this.log('-> API returned unauthorized.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.unauthorized);
            } else if (err === PluginError.RateLimit) {
              this.log('-> API returned rate limit error.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.rateLimit);
            } else if (err === PluginError.NoToken) {
              this.log('-> No token present.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.noToken);
            } else if (err === PluginError.Unknown) {
              this.log('-> Caught unknown error.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.other);
            }
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
      from(this.metaEdit.getPropertyValue(MetaKey.TrelloId, view.file)).subscribe((existing) => {
        if (existing) {
          this.log('Disconnecting trello connected card.');
          this.metaEdit.deleteProperty(MetaKey.TrelloId, view.file);
          this.state.connectedCardId.next(null);
        }
      });
    }
  }

  private selectBoard(boards: TrelloBoard[]): Observable<TrelloBoard> {
    this.boardSuggestModal.options = boards;
    this.boardSuggestModal.open();
    return this.boardSuggestModal.selected.pipe(take(1));
  }

  private selectCard(cards: TrelloCard[]): Observable<TrelloCard> {
    this.cardSuggestModal.options = cards;
    this.cardSuggestModal.open();
    return this.cardSuggestModal.selected.pipe(take(1));
  }

  /**
   * Has the user select a list from the already selected board,
   * then opens the card creation modal. Returns the newly created
   * card.
   */
  private addNewCard(board: TrelloBoard): Observable<TrelloCard> {
    this.log('Beginning add new card flow.');
    return forkJoin({
      labels: this.api.getLabelsFromBoard(board.id),
      list: this.api.getListsFromBoard(board.id).pipe(
        concatMap((lists) => {
          this.listSuggestModal.options = lists;
          this.listSuggestModal.open();
          return this.listSuggestModal.selected;
        }),
        take(1)
      ),
      settings: this.state.settings.pipe(take(1))
    }).pipe(
      concatMap(({ labels, list, settings }) => {
        this.log('-> All add new card observables emitted, setting up card create modal.');
        this.cardCreateModal.board = board;
        this.cardCreateModal.list = list;
        this.cardCreateModal.labels = labels;
        this.cardCreateModal.defaultPosition = settings.newCardPosition;
        this.cardCreateModal.open();
        return this.cardCreateModal.createdCard;
      }),
      take(1)
    );
  }

  /**
   * Adds the trello leaf if not already available
   * @param activate if true, reveal the leaf, if false it will only be added
   */
  private revealTrelloLeaf(activate = false): void {
    this.log('Revealing trello leaf.');
    const leaves = this.app.workspace.getLeavesOfType(TRELLO_VIEW_TYPE);

    if (leaves.length === 0) {
      this.log('-> No trello leaf found, creating.');
      this.state.settings
        .pipe(
          take(1),
          map((s) => s.openToSide)
        )
        .subscribe((side) => {
          this.log(`-> Creating leaf on ${side} side.`);
          const leaf =
            side === LeafSide.Right ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeftLeaf(false);
          leaf.setViewState({ type: TRELLO_VIEW_TYPE });
          if (activate) {
            this.log('-> Leaf created, revealing.');
            this.app.workspace.revealLeaf(leaf);
          }
        });
    } else if (activate) {
      this.log('-> Trello leaf found, revealing.');
      this.app.workspace.revealLeaf(leaves[0]);
    }
  }

  // From https://github.com/chhoumann/MetaEdit/blob/master/src/metaController.ts
  private async deleteProperty(property: string, file: TFile): Promise<void> {
    if (file) {
      const fileContent = await this.app.vault.read(file);
      const splitContent = fileContent.split('\n');
      const regexp = new RegExp(`^${property}:`);

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
