import { App, PluginSettingTab, Setting } from 'obsidian';
import { map, take } from 'rxjs/operators';
import { TrelloPlugin } from '../plugin';
import { BoardSelectModal } from './board-select-modal';

export class TrelloSettings extends PluginSettingTab {
  private readonly boardSelectModal = new BoardSelectModal(
    this.plugin,
    this.plugin.app
  );
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app, plugin);
  }

  // TODO: Handle no token
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
