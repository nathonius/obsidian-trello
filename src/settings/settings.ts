import { App, PluginSettingTab, Setting } from 'obsidian';
import { map, take } from 'rxjs/operators';
import { LeafSide, PluginSettings } from 'src/interfaces';
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
    this.plugin.state.settings.pipe(take(1)).subscribe((settings) => {
      this.buildTokenSetting(this.containerEl, settings);
      this.buildBoardSelectSetting(this.containerEl);
      this.buildOpenToSideSetting(this.containerEl, settings);
    });
  }

  private async buildTokenSetting(
    containerEl: HTMLElement,
    settings: PluginSettings
  ): Promise<void> {
    new Setting(containerEl)
      .setName('Trello Token')
      .setDesc('Your API token.')
      .addText((text) => {
        text
          .setPlaceholder('Enter token')
          .setValue(settings.token)
          .onChange(async (value: string) => {
            await this.plugin.state.updateSetting('token', value);
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

  private buildOpenToSideSetting(
    containerEl: HTMLElement,
    settings: PluginSettings
  ): void {
    new Setting(containerEl)
      .setName('Open to Side')
      .setDesc('Whether the Trello pane should open to the left or right side.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption(LeafSide.Right, 'Right')
          .addOption(LeafSide.Left, 'Left')
          .setValue(settings.openToSide)
          .onChange(async (value) => {
            await this.plugin.state.updateSetting(
              'openToSide',
              value as LeafSide
            );
          });
      });
  }
}
