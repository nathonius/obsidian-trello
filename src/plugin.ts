import { FileView, Notice, Plugin, addIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { concat, forkJoin, from, iif, Observable, of, Subject } from 'rxjs';
import { take, map, concatMap, tap, takeUntil, delay } from 'rxjs/operators';
import { nanoid } from 'nanoid';
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
import { LeafSide, PluginData, PluginError, TrelloBoard, TrelloCard } from './interfaces';
import { TrelloAPI } from './api';
import { TrelloSettings } from './settings';
import { PluginState } from './state';
import { CardSuggestModal, BoardSuggestModal, CardCreateModal, ListSuggestModal, CustomizeUIModal } from './modal';
import { TrelloView } from './view/view';
import { migrations } from './migrations';
import { MetaEditWrapper } from './meta-edit';

export class TrelloPlugin extends Plugin {
  metaEdit = new MetaEditWrapper(this);
  api!: TrelloAPI;
  state!: PluginState;
  view!: TrelloView;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardCreateModal = new CardCreateModal(this.app, this);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  customizeUIModal!: CustomizeUIModal;
  readonly listSuggestModal = new ListSuggestModal(this.app);

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
      migrations[savedData.version](this, data);
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
    this.log('TrelloPlugin.openTrelloSettings', 'Opening settings');
    (this.app as any).setting.openTabById('obsidian-trello');
    (this.app as any).setting.open();
  }

  log(context: string, message: string, logLevel: LogLevel = LogLevel.Info): void {
    if (this.state.verboseLogging.value) {
      const log = `OBISIDAN-TRELLO: (${context}) ${message}`;
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
    if (!file || !this.metaEdit.available) {
      return;
    }

    const boardCardId = await this.metaEdit.plugin.getPropertyValue(MetaKey.BoardCard, file);
    let trelloId = await this.metaEdit.plugin.getPropertyValue(MetaKey.TrelloId, file);

    if (boardCardId && !trelloId) {
      // Migrate to add new ID
      const newId = nanoid();
      const [boardId, cardId] = boardCardId.split(';');
      await this.metaEdit.plugin.createYamlProperty(MetaKey.TrelloId, newId, file);
      await new Promise((resolve) => window.setTimeout(resolve, METAEDIT_DEBOUNCE));
      this.state.updateConnectedCard(newId, { boardId, cardId });
      trelloId = newId;
    }

    if (!boardCardId) {
      this.log('TrelloPlugin.handleFile', 'File not trello connected');
      this.state.boardCardId.next(null);
      this.state.connectedCardId.next(null);
      return;
    }

    // This file is trello connected
    this.log('TrelloPlugin.handleFile', `File trello connected, board/card ID ${boardCardId}, plugin ID ${trelloId}`);
    this.state.boardCardId.next(boardCardId);
    this.state.connectedCardId.next(trelloId as string);
  }

  /**
   * Opens multiple suggest modals to select first a trello board and then a trello card
   * Adds the board and card IDs to the frontmatter of the note, then reveals the leaf
   */
  connectTrelloCard(): void {
    const view = this.app.workspace.activeLeaf?.view;

    // Might need this later
    let board: TrelloBoard;

    if (view instanceof FileView && this.metaEdit.available) {
      this.log('TrelloPlugin.connectTrelloCard', 'Connecting trello card');
      this.state.settings
        .pipe(
          take(1),
          map((s) => s.selectedBoards),
          // If boards were selected, use those. Otherwise, call API.
          concatMap((boards) => iif(() => boards.length > 0, of(boards), this.api.getBoards())),
          tap(() => {
            this.log('TrelloPlugin.connectTrelloCard', '-> Got boards');
          }),
          // Open board suggestion modal
          concatMap((boards) => this.selectBoard(boards)),
          tap((selectedBoard) => {
            this.log('TrelloPlugin.connectTrelloCard', `-> Selected board ${selectedBoard.id}`);
            board = selectedBoard;
          }),
          // Get available cards from selected board
          concatMap((selectedBoard) => this.api.getCardsFromBoard(selectedBoard.id)),
          tap((cards) => {
            this.log('TrelloPlugin.connectTrelloCard', `-> Got ${cards.length} cards.`);
          }),
          // Open card suggestion modal
          concatMap((cards: TrelloCard[]) => this.selectCard(cards)),
          tap((selectedCard: TrelloCard) => {
            this.log('TrelloPlugin.connectTrelloCard', `-> Selected card ${selectedCard.id}`);
          }),
          concatMap((selectedCard: TrelloCard) =>
            iif(
              () => selectedCard === NEW_TRELLO_CARD,
              this.addNewCard(board).pipe(
                tap(() => {
                  this.log('TrelloPlugin.connectTrelloCard', 'Beginning add new card flow.');
                })
              ),
              of(selectedCard).pipe(
                tap(() => {
                  this.log('TrelloPlugin.connectTrelloCard', '-> Selected existing card');
                })
              )
            )
          ),
          concatMap((selectedCard: TrelloCard) =>
            forkJoin({
              selectedCard: of(selectedCard),
              existingId: from(this.metaEdit.plugin.getPropertyValue(MetaKey.TrelloId, view.file))
            })
          ),
          map(({ selectedCard, existingId }: { selectedCard: TrelloCard; existingId: string | undefined }) => {
            const trelloId = existingId ? existingId : nanoid();
            this.log('TrelloPlugin.connectTrelloCard', `-> Updating file with plugin ID ${trelloId}`);
            this.state.updateConnectedCard(trelloId, { cardId: selectedCard.id, boardId: selectedCard.idBoard });
            this.state.connectedCardId.next(trelloId);
            const boardCardId = `${selectedCard.idBoard};${selectedCard.id}`;
            this.log('TrelloPlugin.connectTrelloCard', `-> Updating file with board/card ID ${boardCardId}`);
            this.state.boardCardId.next(boardCardId);
            return { boardCardId, trelloId };
          }),
          concatMap(({ boardCardId, trelloId }: { boardCardId: string; trelloId: string }) =>
            concat(
              this.metaEdit.updateOrCreateMeta(MetaKey.TrelloId, trelloId, view.file).pipe(
                tap(() => {
                  this.log('TrelloPlugin.connectTrelloCard', '-> Adding plugin ID meta key.');
                }),
                delay(METAEDIT_DEBOUNCE)
              ),
              this.metaEdit.updateOrCreateMeta(MetaKey.BoardCard, boardCardId, view.file).pipe(
                tap(() => {
                  this.log('TrelloPlugin.connectTrelloCard', '-> Adding board/card ID meta key.');
                })
              )
            )
          )
        )
        .subscribe({
          next: () => {
            this.log('TrelloPlugin.connectTrelloCard', '-> Done connecting card.');
            this.revealTrelloLeaf(true);
          },
          error: (err) => {
            if (err === PluginError.Abort) {
              this.log('TrelloPlugin.connectTrelloCard', '-> Aborting connect flow.');
            } else if (err === PluginError.Unauthorized) {
              this.log('TrelloPlugin.connectTrelloCard', '-> API returned unauthorized.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.unauthorized);
            } else if (err === PluginError.RateLimit) {
              this.log('TrelloPlugin.connectTrelloCard', '-> API returned rate limit error.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.rateLimit);
            } else if (err === PluginError.NoToken) {
              this.log('TrelloPlugin.connectTrelloCard', '-> No token present.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.noToken);
            } else if (err === PluginError.Unknown) {
              this.log('TrelloPlugin.connectTrelloCard', '-> Caught unknown error.', LogLevel.Error);
              new Notice(TRELLO_ERRORS.other);
            }
          }
        });
    }
  }

  /**
   * Removes the trello frontmatter property from the current file.
   */
  async disconnectTrelloCard(): Promise<void> {
    const view = this.app.workspace.activeLeaf?.view;

    if (view instanceof FileView && this.metaEdit.available) {
      this.log('TrelloPlugin.disconnectTrelloCard', 'Disconnecting trello connected card.');

      const existingPluginId = await this.metaEdit.plugin.getPropertyValue(MetaKey.TrelloId, view.file);
      if (existingPluginId) {
        await this.metaEdit.plugin.deleteProperty(MetaKey.TrelloId, view.file);
        await new Promise((resolve) => window.setTimeout(resolve, METAEDIT_DEBOUNCE));
        this.state.updateConnectedCard(existingPluginId, null);
        this.state.connectedCardId.next(null);
        this.log('TrelloPlugin.disconnectTrelloCard', '-> Removed plugin ID.');
      }

      await this.metaEdit.plugin.deleteProperty(MetaKey.BoardCard, view.file);
      this.state.boardCardId.next(null);
      this.log('TrelloPlugin.disconnectTrelloCard', '-> Removed board/card ID.');
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
        this.log('TrelloPlugin.addNewCard', '-> All add new card observables emitted, setting up card create modal.');
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
    this.log('TrelloPlugin.revealTrelloLeaf', 'Revealing trello leaf.');
    const leaves = this.app.workspace.getLeavesOfType(TRELLO_VIEW_TYPE);

    if (leaves.length === 0) {
      this.log('TrelloPlugin.revealTrelloLeaf', '-> No trello leaf found, creating.');
      this.state.settings
        .pipe(
          take(1),
          map((s) => s.openToSide)
        )
        .subscribe((side) => {
          this.log('TrelloPlugin.revealTrelloLeaf', `-> Creating leaf on ${side} side.`);
          const leaf =
            side === LeafSide.Right ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeftLeaf(false);
          leaf.setViewState({ type: TRELLO_VIEW_TYPE });
          if (activate) {
            this.log('TrelloPlugin.revealTrelloLeaf', '-> Leaf created, revealing.');
            this.app.workspace.revealLeaf(leaf);
          }
        });
    } else if (activate) {
      this.log('TrelloPlugin.revealTrelloLeaf', '-> Trello leaf found, revealing.');
      this.app.workspace.revealLeaf(leaves[0]);
    }
  }
}
