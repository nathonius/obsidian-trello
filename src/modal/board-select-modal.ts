import { App, Modal, Notice } from 'obsidian';
import { forkJoin } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { TRELLO_ERRORS } from '../constants';
import { TrelloBoard } from '../interfaces';
import { TrelloPlugin } from '../plugin';

export class BoardSelectModal extends Modal {
  private readonly selectedBoards = this.plugin.state.settings.pipe(
    take(1),
    map((settings) => (settings.selectedBoards ? settings.selectedBoards : []))
  );
  private newState: Record<string, TrelloBoard> = {};
  constructor(private readonly plugin: TrelloPlugin, app: App) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();

    forkJoin({
      selected: this.selectedBoards,
      boards: this.plugin.api.getBoards()
    }).subscribe({
      next: ({ selected, boards }) => {
        const container = this.contentEl.createDiv('trello-board-select--container');
        container.createEl('h2', { text: 'Boards', cls: 'trello-board-select--title' });

        // Set the current state
        this.newState = {};
        selected.forEach((board) => {
          this.newState[board.id] = board;
        });

        // Add toggle for each board
        boards.forEach((board) => {
          this.buildToggle(board, container);
        });

        // Add save/cancel
        const controls = this.contentEl.createDiv('trello-board-select--controls');
        const saveButton = controls.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveButton.addEventListener('click', () => {
          this.onSave();
        });
        const cancelButton = controls.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
          this.close();
        });
      },
      error: () => {
        // Show a button to go to settings if no token is set.
        if (!this.plugin.state.currentToken.value || this.plugin.state.currentToken.value === '') {
          const container = this.contentEl.createDiv({
            cls: 'trello-board-select--empty-state',
            text: 'An API token is required.'
          });
          const button = container.createEl('button', {
            text: 'Setup Trello'
          });
          button.addEventListener('click', () => {
            this.plugin.openTrelloSettings();
            this.close();
          });
        }
        // Show a notice about the API error otherwise.
        else {
          new Notice(TRELLO_ERRORS.other);
          this.close();
        }
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Uses obsidian's toggle styling to create toggle switches for each board
   */
  private buildToggle(board: TrelloBoard, parent: HTMLElement): void {
    const container = parent.createDiv('trello-board-select--toggle-container');
    container.createDiv({ text: board.name, cls: 'trello-board-select--toggle-label' });
    const toggle = container.createDiv({ cls: 'trello-board-select--toggle checkbox-container' });
    if (this.newState[board.id]) {
      toggle.addClass('is-enabled');
    }
    container.addEventListener('click', () => {
      if (this.newState[board.id]) {
        toggle.removeClass('is-enabled');
        delete this.newState[board.id];
      } else {
        toggle.addClass('is-enabled');
        this.newState[board.id] = board;
      }
    });
  }

  private onSave(): void {
    const newSelected: TrelloBoard[] = Object.values(this.newState);
    this.plugin.state.updateSetting('selectedBoards', newSelected);
    this.close();
  }
}
