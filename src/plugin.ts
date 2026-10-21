import {
  BoardSuggestModal,
  CardCreateModal,
  CardSuggestModal,
  CustomizeUIModal,
  ListSuggestModal,
  UnlinkSuggestModal
} from './modal';
import {
  CUSTOM_ICONS,
  DEFAULT_DATA,
  DEFAULT_SETTINGS,
  LogLevel,
  MetaKey,
  NEW_TRELLO_CARD,
  TRELLO_ERRORS,
  TRELLO_MY_CARDS_VIEW_TYPE,
  TRELLO_VIEW_TYPE
} from './constants';
import { CardRef, LeafSide, PluginData, PluginError, TrelloBoard, TrelloCard } from './interfaces';
import { Notice, Plugin, TFile, WorkspaceLeaf, addIcon, Platform } from 'obsidian';
import { Observable, Subject, concat, firstValueFrom, forkJoin, iif, of } from 'rxjs';
import { concatMap, map, take, tap } from 'rxjs/operators';

import { PluginState } from './state';
import { TrelloAPI } from './api';
import { TrelloSettings } from './settings';
import { TrelloMyCardsView } from './view/my-cards-view';
import { TrelloView } from './view/view';
import { YamlHandler, formatCardRef } from './yaml-handler';
import { migrate } from './migrations';
import { nanoid } from 'nanoid';

export class TrelloPlugin extends Plugin {
  yamlHandler = new YamlHandler(this);
  api!: TrelloAPI;
  state!: PluginState;
  view!: TrelloView;
  destroy = new Subject<void>();
  readonly boardSuggestModal = new BoardSuggestModal(this.app);
  readonly cardCreateModal = new CardCreateModal(this.app, this);
  readonly cardSuggestModal = new CardSuggestModal(this.app);
  customizeUIModal!: CustomizeUIModal;
  readonly listSuggestModal = new ListSuggestModal(this.app);
  readonly unlinkSuggestModal = new UnlinkSuggestModal(this.app);
  private fileHandleSequence = 0;
  private readonly cardBoardSyncs = new Map<string, Promise<void>>();

  async onload(): Promise<void> {
    // Set up data and default data.
    const savedData: PluginData | undefined = await this.loadData();
    const data: PluginData = Object.assign({}, DEFAULT_DATA, savedData);
    data.settings = Object.assign({}, DEFAULT_SETTINGS, savedData?.settings);
    data.settings.customUi = Object.assign({}, DEFAULT_SETTINGS.customUi, savedData?.settings.customUi);

    if (!Platform.isWin && !Platform.isMacOS) {
      data.settings.openInDesktop = false;
    }

    this.state = new PluginState(this, data);

    // Create new API instance
    this.api = new TrelloAPI(this);

    // Configure custom UI modal
    this.customizeUIModal = new CustomizeUIModal(this.app, this);

    // Add custom icon(s)
    addIcon(CUSTOM_ICONS.trello.id, CUSTOM_ICONS.trello.svgContent);

    // Execute version migration
    if (savedData && savedData.version !== DEFAULT_DATA.version) {
      migrate(this, data);
    }

    // Register trello view type
    this.registerView(TRELLO_VIEW_TYPE, (leaf: WorkspaceLeaf) => (this.view = new TrelloView(this, leaf)));

    this.registerView(TRELLO_MY_CARDS_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TrelloMyCardsView(this, leaf));

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

    this.addCommand({
      id: 'trello-plugin-reveal-my-cards',
      name: 'Show my Trello cards',
      callback: () => {
        this.revealTrelloLeaf(true, TRELLO_MY_CARDS_VIEW_TYPE);
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
    this.app.workspace.detachLeavesOfType(TRELLO_MY_CARDS_VIEW_TYPE);
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
    if (this.state.getSetting('verboseLogging')) {
      const log = `OBSIDIAN-TRELLO: (${context}) ${message}`;
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
    const sequence = ++this.fileHandleSequence;
    // See if we need to do anything
    if (!file) {
      this.state.cardRefs.next([]);
      this.state.connectedCardId.next(null);
      return;
    }

    const refs = this.yamlHandler.getCardRefs(file);
    let trelloId = this.yamlHandler.getPropertyValue(MetaKey.TrelloId, file);

    if (refs.length > 0 && !trelloId) {
      // Migrate to add new ID
      const newId = nanoid();
      await firstValueFrom(this.yamlHandler.updateOrCreateMeta(MetaKey.TrelloId, newId, file));
      this.state.updateConnectedCard(newId, refs[0]);
      trelloId = newId;
    }

    // A slower frontmatter migration must not replace the state of a note
    // that was opened while it was in progress.
    if (sequence !== this.fileHandleSequence || this.app.workspace.getActiveFile()?.path !== file.path) {
      return;
    }

    if (refs.length === 0) {
      this.log('TrelloPlugin.handleFile', 'File not trello connected');
      this.state.cardRefs.next([]);
      this.state.connectedCardId.next(null);
      return;
    }

    // This file is trello connected
    this.log('TrelloPlugin.handleFile', `File trello connected, ${refs.length} card(s), plugin ID ${trelloId}`);
    this.state.connectedCardId.next(trelloId as string);
    this.state.cardRefs.next(refs);
  }

  /**
   * Re-read the links of the active note, for when settings that affect them change.
   */
  reloadActiveFile(): void {
    this.handleFile(this.app.workspace.getActiveFile());
  }

  /**
   * If the card now lives on a different board than the active note records
   * (the card was moved in Trello), update the note and saved connection.
   */
  syncCardBoard(card: TrelloCard): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return Promise.resolve();
    }
    // Only touch a note that still points at this card, the user may have switched files.
    const stored = this.yamlHandler.getCardRefs(file).find((ref) => ref.cardId === card.id);
    if (!stored || stored.boardId === card.idBoard) {
      return Promise.resolve();
    }
    this.log(
      'TrelloPlugin.syncCardBoard',
      `Card moved from board ${stored.boardId} to ${card.idBoard}, updating note.`
    );
    const previous = this.cardBoardSyncs.get(file.path) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        const { changed, primary } = await this.yamlHandler.replaceCardRef(
          { boardId: card.idBoard, cardId: card.id },
          file
        );
        if (!changed) {
          return;
        }
        const trelloId = this.yamlHandler.getPropertyValue(MetaKey.TrelloId, file);
        if (trelloId && primary) {
          this.state.updateConnectedCard(trelloId, primary);
        }
      });
    this.cardBoardSyncs.set(file.path, operation);
    return operation
      .catch((err) => {
        this.log('TrelloPlugin.syncCardBoard', `Could not update note: ${String(err)}`, LogLevel.Error);
        new Notice(TRELLO_ERRORS.movedCardSave);
        throw err;
      })
      .finally(() => {
        if (this.cardBoardSyncs.get(file.path) === operation) {
          this.cardBoardSyncs.delete(file.path);
        }
      });
  }

  /**
   * Opens multiple suggest modals to select first a trello board and then a trello card
   * Adds the board and card IDs to the frontmatter of the note, then reveals the leaf
   */
  connectTrelloCard(): void {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      this.log('TrelloPlugin.connectTrelloCard', 'No file available to connect trello card.', LogLevel.Warn);
      return;
    }
    // The link is stored in frontmatter, which only exists in Markdown files
    if (file.extension !== 'md') {
      this.log('TrelloPlugin.connectTrelloCard', `Unsupported file type ${file.extension}.`, LogLevel.Warn);
      new Notice(TRELLO_ERRORS.unsupportedFile);
      return;
    }

    // Might need this later
    let board: TrelloBoard;

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
            existingId: of(this.yamlHandler.getPropertyValue(MetaKey.TrelloId, file))
          })
        ),
        map(({ selectedCard, existingId }: { selectedCard: TrelloCard; existingId: string | undefined }) => {
          const trelloId = existingId ? existingId : nanoid();
          const newRef: CardRef = { cardId: selectedCard.id, boardId: selectedCard.idBoard };
          // Without the multiple cards setting a new card always replaces the old one
          const existingRefs = this.state.getSetting('multipleCards') ? this.yamlHandler.getCardRefs(file) : [];
          if (existingRefs.some((ref) => ref.cardId === newRef.cardId)) {
            new Notice(TRELLO_ERRORS.duplicateCard);
            throw PluginError.Abort;
          }
          const boardCardId = formatCardRef(newRef);
          this.log('TrelloPlugin.connectTrelloCard', `-> Updating file with board/card ID ${boardCardId}`);
          // The first card goes in the original property, which keeps working with the setting off
          const addToList = existingRefs.length > 0;
          this.log('TrelloPlugin.connectTrelloCard', `-> Updating file with plugin ID ${trelloId}`);
          this.state.updateConnectedCard(trelloId, addToList ? existingRefs[0] : newRef);
          this.state.connectedCardId.next(trelloId);
          this.state.cardRefs.next(addToList ? [...existingRefs, newRef] : [newRef]);
          return { boardCardId, trelloId, newRef, addToList };
        }),
        concatMap(({ boardCardId, trelloId, newRef, addToList }) =>
          concat(
            this.yamlHandler.updateOrCreateMeta(MetaKey.TrelloId, trelloId, file).pipe(
              tap(() => {
                this.log('TrelloPlugin.connectTrelloCard', '-> Adding plugin ID meta key.');
              })
            ),
            (addToList
              ? this.yamlHandler.addCardRef(newRef, file)
              : this.yamlHandler.updateOrCreateMeta(MetaKey.BoardCard, boardCardId, file)
            ).pipe(
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

  /**
   * Removes the trello frontmatter property from the current file.
   */
  async disconnectTrelloCard(): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    if (!file) {
      this.log('TrelloPlugin.disconnectTrelloCard', 'No file available to connect trello card.', LogLevel.Warn);
      return;
    }
    if (file.extension !== 'md') {
      this.log('TrelloPlugin.disconnectTrelloCard', `Unsupported file type ${file.extension}.`, LogLevel.Warn);
      new Notice(TRELLO_ERRORS.unsupportedFile);
      return;
    }

    this.log('TrelloPlugin.disconnectTrelloCard', 'Disconnecting trello connected card.');

    // With several cards, let the user choose which one to unlink
    const refs = this.yamlHandler.getCardRefs(file);
    if (refs.length > 1) {
      const cardId = await this.selectCardToUnlink(refs);
      if (cardId === undefined) {
        return;
      }
      if (cardId !== null) {
        const remainingRefs = await this.yamlHandler.removeCardRef(cardId, file);
        const existingPluginId = this.yamlHandler.getPropertyValue(MetaKey.TrelloId, file);
        if (existingPluginId && remainingRefs.length > 0) {
          this.state.updateConnectedCard(existingPluginId, remainingRefs[0]);
        }
        this.state.cardRefs.next(remainingRefs);
        this.log('TrelloPlugin.disconnectTrelloCard', `-> Removed card ${cardId}.`);
        return;
      }
    }

    const existingPluginId = this.yamlHandler.getPropertyValue(MetaKey.TrelloId, file);
    if (existingPluginId) {
      await this.yamlHandler.deleteProperty(MetaKey.TrelloId, file);
      this.state.updateConnectedCard(existingPluginId, null);
      this.state.connectedCardId.next(null);
      this.log('TrelloPlugin.disconnectTrelloCard', '-> Removed plugin ID.');
    }

    await this.yamlHandler.deleteProperty(MetaKey.BoardCard, file);
    await this.yamlHandler.deleteProperty(MetaKey.Cards, file);
    this.state.cardRefs.next([]);
    this.log('TrelloPlugin.disconnectTrelloCard', '-> Removed board/card ID.');
  }

  /**
   * Asks which linked card to unlink.
   * Resolves to the card ID, null for all cards or undefined if the user cancelled.
   */
  private async selectCardToUnlink(refs: CardRef[]): Promise<string | null | undefined> {
    const options = refs.map((ref) => ({
      label: this.state.cardCache[ref.cardId]?.item.name ?? `Card ${ref.cardId}`,
      cardId: ref.cardId as string | null
    }));
    options.push({ label: 'All cards', cardId: null });
    this.unlinkSuggestModal.options = options;
    this.unlinkSuggestModal.open();
    try {
      return (await firstValueFrom(this.unlinkSuggestModal.selected)).cardId;
    } catch (err) {
      if (err === PluginError.Abort) {
        return undefined;
      }
      throw err;
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
   * @param viewType which of the plugin's views to add
   */
  private revealTrelloLeaf(activate = false, viewType = TRELLO_VIEW_TYPE): void {
    this.log('TrelloPlugin.revealTrelloLeaf', 'Revealing trello leaf.');
    const leaves = this.app.workspace.getLeavesOfType(viewType);

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
          if (!leaf) {
            this.log('TrelloPlugin.revealTrelloLeaf', `-> Could not create a leaf on the ${side} side.`, LogLevel.Warn);
            return;
          }
          leaf.setViewState({ type: viewType });
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
