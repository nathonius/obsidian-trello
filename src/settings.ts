import { App, Modal, PluginSettingTab, Setting } from 'obsidian';
import { ReplaySubject, Subject, combineLatest, forkJoin } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { TrelloBoard } from './interfaces';
import { TrelloPlugin } from './plugin';

export class TrelloSettings extends PluginSettingTab {
  private readonly boardSelectModal = new BoardSelectModal(
    this.plugin,
    this.plugin.app
  );
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app, plugin);
  }

  async display(): Promise<void> {
    // Prepare container
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Obsidian Trello settings.' });

    // Build settings
    await this.buildTokenSetting(this.containerEl);
    await this.buildBoardSelectSetting(this.containerEl);
  }

  private async buildTokenSetting(containerEl: HTMLElement): Promise<void> {
    this.plugin.state.settings
      .pipe(
        take(1),
        map((settings) => settings.token)
      )
      .subscribe((token) => {
        new Setting(containerEl)
          .setName('Trello Token')
          .setDesc('Your API token.')
          .addText((text) => {
            text
              .setPlaceholder('Enter token')
              .setValue(token)
              .onChange(async (value: string) => {
                await this.plugin.state.updateSetting('token', value);
              });
          });
      });
  }

  private buildBoardSelectSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Select Boards')
      .setDesc('These boards will be available to select cards from.')
      .addButton((button) => {
        button.setButtonText('Select').onClick(() => {
          this.boardSelectModal.open();
        });
      });
  }
}

class BoardSelectModal extends Modal {
  constructor(private readonly plugin: TrelloPlugin, app: App) {
    super(app);
  }

  onOpen() {
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
      const checkboxes: HTMLInputElement[] = [];
      boards.forEach((board) => {
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
        checkboxes.push(checkbox);
      });
      const controls = this.contentEl.createDiv();
      const saveButton = controls.createEl('button', { text: 'Save' });
      saveButton.addEventListener('click', () => {
        const newSelected: string[] = [];
        checkboxes.forEach((box) => {
          if (box.checked) {
            newSelected.push(box.value);
          }
        });
        this.plugin.state.updateSetting('selectedBoards', newSelected);
        this.close();
      });
      const cancelButton = controls.createEl('button', { text: 'Cancel' });
      cancelButton.addEventListener('click', () => {
        this.close();
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
