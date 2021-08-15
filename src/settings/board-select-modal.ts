import { App, Modal } from 'obsidian';
import { forkJoin } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { TrelloBoard } from '../interfaces';
import { TrelloPlugin } from '../plugin';

export class BoardSelectModal extends Modal {
  constructor(private readonly plugin: TrelloPlugin, app: App) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();

    forkJoin({
      selected: this.plugin.state.settings.pipe(
        take(1),
        map((settings) =>
          settings.selectedBoards ? settings.selectedBoards : []
        )
      ),
      boards: this.plugin.api.getBoards().pipe(map((resp) => resp.response))
    }).subscribe(({ selected, boards }) => {
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
        this.onSave(checkboxes);
      });
      const cancelButton = controls.createEl('button', { text: 'Cancel' });
      cancelButton.addEventListener('click', () => {
        this.close();
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildCheckbox(
    selected: string[],
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
    checkbox.checked = selected.includes(board.id);
    container.createEl('label', {
      text: board.name,
      attr: { for: `board-${board.id}` }
    });
    return checkbox;
  }

  private onSave(checkboxes: HTMLInputElement[]): void {
    const newSelected: string[] = [];
    checkboxes.forEach((box) => {
      if (box.checked) {
        newSelected.push(box.value);
      }
    });
    this.plugin.state.updateSetting('selectedBoards', newSelected);
    this.close();
  }
}
