import { App, Modal, Notice } from 'obsidian';
import { forkJoin } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { TrelloBoard } from '../interfaces';
import { TrelloPlugin } from '../plugin';

export class BoardSelectModal extends Modal {
  private token = '';
  private readonly selectedBoards = this.plugin.state.settings.pipe(
    take(1),
    map((settings) => (settings.selectedBoards ? settings.selectedBoards : []))
  );
  constructor(private readonly plugin: TrelloPlugin, app: App) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();

    forkJoin({
      token: this.plugin.state.settings.pipe(
        take(1),
        map((settings) => settings.token)
      ),
      selected: this.selectedBoards,
      boards: this.plugin.api.getBoards().pipe(map((resp) => resp.response))
    })
      .pipe(
        tap(({ token }) => {
          this.token = token;
        })
      )
      .subscribe({
        next: ({ selected, boards }) => {
          this.contentEl.createEl('h2', { text: 'Boards' });

          // Add checkboxes
          const checkboxes: HTMLInputElement[] = [];
          boards.forEach((board) => {
            checkboxes.push(this.buildCheckbox(selected, board));
          });

          // Add save/cancel
          const controls = this.contentEl.createDiv();
          const saveButton = controls.createEl('button', { text: 'Save' });
          saveButton.addEventListener('click', () => {
            this.onSave(boards, checkboxes);
          });
          const cancelButton = controls.createEl('button', { text: 'Cancel' });
          cancelButton.addEventListener('click', () => {
            this.close();
          });
        },
        error: () => {
          if (!this.token || this.token === '') {
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
          } else {
            new Notice('Could not reach Trello API.');
            this.close();
          }
        }
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildCheckbox(
    selected: TrelloBoard[],
    board: TrelloBoard
  ): HTMLInputElement {
    const container = this.contentEl.createDiv();
    const checkbox = container.createEl('input', {
      attr: {
        type: 'checkbox',
        id: `board-${board.id}`
      }
    });
    checkbox.value = board.id;
    checkbox.checked = selected.findIndex((s) => s.id === board.id) !== -1;
    container.createEl('label', {
      text: board.name,
      attr: { for: `board-${board.id}` }
    });
    return checkbox;
  }

  private onSave(boards: TrelloBoard[], checkboxes: HTMLInputElement[]): void {
    const newSelected: TrelloBoard[] = [];
    checkboxes.forEach((box) => {
      if (box.checked) {
        const board = boards.find((b) => b.id === box.value);
        if (board) {
          newSelected.push(board);
        }
      }
    });
    this.plugin.state.updateSetting('selectedBoards', newSelected);
    this.close();
  }
}
