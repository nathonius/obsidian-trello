import { App, PluginSettingTab, Setting } from 'obsidian';
import { take } from 'rxjs/operators';
import { GLOBAL_UI, TRELLO_TOKEN_URL } from './constants';
import { CardPosition, LeafSide, PluginSettings } from './interfaces';
import { TrelloPlugin } from './plugin';
import { BoardSelectModal } from './modal';

export class TrelloSettings extends PluginSettingTab {
  private readonly boardSelectModal = new BoardSelectModal(this.plugin.app, this.plugin);
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app, plugin);
  }

  async display(): Promise<void> {
    this.plugin.log('TrelloSettings.display', 'Initializing settings');
    // Prepare container
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Obsidian Trello settings.' });

    // Build settings
    this.plugin.state.settings.pipe(take(1)).subscribe((settings) => {
      this.buildTokenSetting(this.containerEl, settings);
      this.buildUiConfigSetting(this.containerEl);
      this.buildBoardSelectSetting(this.containerEl);
      this.buildOpenToSideSetting(this.containerEl, settings);
      this.buildNewCardPositionSetting(this.containerEl, settings);
      this.buildMovedCardPositionSetting(this.containerEl, settings);
      this.buildVerboseLoggingSetting(this.containerEl, settings);
    });
  }

  private async buildTokenSetting(containerEl: HTMLElement, settings: PluginSettings): Promise<void> {
    this.plugin.log('TrelloSettings.buildTokenSetting', `-> Adding token setting with initial value ${settings.token}`);
    const descFragment = new DocumentFragment();
    const desc = descFragment.createDiv({ cls: 'setting-item-description' });
    desc.innerHTML = `Your API token. <a href="${TRELLO_TOKEN_URL}">Generate one</a> then copy it here. This token can be revoked at any time in your Trello account settings.`;
    new Setting(containerEl)
      .setName('Trello Token')
      .setDesc(descFragment)
      .addText((text) => {
        text
          .setPlaceholder('Enter token')
          .setValue(settings.token)
          .onChange((value: string) => {
            this.plugin.state.updateSetting('token', value.trim());
            this.plugin.view.updateCard();
          });
      });
  }

  private buildUiConfigSetting(containerEl: HTMLElement): void {
    this.plugin.log('TrelloSettings.buildConfigSetting', '-> Adding UI config setting');
    new Setting(containerEl)
      .setName('Customize UI')
      .setDesc('Configure which parts of connected trello cards are displayed by default. Can be overridden per note.')
      .addButton((button) => {
        button.setButtonText('Configure').onClick(() => {
          this.plugin.customizeUIModal.source.next(GLOBAL_UI);
          this.plugin.customizeUIModal.open();
        });
      });
  }

  private buildBoardSelectSetting(containerEl: HTMLElement): void {
    this.plugin.log('TrelloSettings.buildBoardSelectSetting', `-> Adding board select setting`);
    new Setting(containerEl)
      .setName('Select Boards')
      .setDesc('These boards will be available to select cards from.')
      .addButton((button) => {
        button.setButtonText('Select').onClick(() => {
          this.boardSelectModal.open();
        });
      });
  }

  private buildOpenToSideSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildOpenToSideSetting',
      `-> Adding open to side setting with initial value ${settings.openToSide}`
    );
    new Setting(containerEl)
      .setName('Open to Side')
      .setDesc('Whether the Trello pane should open to the left or right side.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption(LeafSide.Right, 'Right')
          .addOption(LeafSide.Left, 'Left')
          .setValue(settings.openToSide)
          .onChange((value) => {
            this.plugin.state.updateSetting('openToSide', value as LeafSide);
          });
      });
  }

  private buildNewCardPositionSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildNewCardPositionSetting',
      `-> Adding new card position setting with initial value ${settings.newCardPosition}`
    );
    new Setting(containerEl)
      .setName('New Card Position')
      .setDesc(
        'Whether newly created cards should be added to the top or bottom of the list by default. Can be overridden when adding a card.'
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption(CardPosition.Top, 'Top')
          .addOption(CardPosition.Bottom, 'Bottom')
          .setValue(settings.newCardPosition)
          .onChange((value) => {
            this.plugin.state.updateSetting('newCardPosition', value as CardPosition);
          });
      });
  }

  private buildMovedCardPositionSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildMovedCardPositionSetting',
      `-> Adding moved card position setting with initial value ${settings.movedCardPosition}`
    );
    new Setting(containerEl)
      .setName('Moved Card Position')
      .setDesc(
        'When moving a card from one list to another, should it be moved to the top or bottom of the selected list.'
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption(CardPosition.Top, 'Top')
          .addOption(CardPosition.Bottom, 'Bottom')
          .setValue(settings.movedCardPosition)
          .onChange((value) => {
            this.plugin.state.updateSetting('movedCardPosition', value as CardPosition);
          });
      });
  }

  private buildVerboseLoggingSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildVerboseLoggingSetting',
      `-> Adding verbose logging setting with initial value ${settings.verboseLogging}`
    );
    new Setting(containerEl)
      .setName('Verbose Logging')
      .setDesc("Enable this if you're having trouble with the plugin. Logs will be enabled in the console.")
      .addToggle((toggle) => {
        toggle.setValue(settings.verboseLogging).onChange((value) => {
          this.plugin.state.updateSetting('verboseLogging', value);
        });
      });
  }
}
