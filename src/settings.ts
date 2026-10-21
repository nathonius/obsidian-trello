import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import { CardPosition, LeafSide, PluginSettings } from './interfaces';
import { GLOBAL_UI, TRELLO_TOKEN_URL } from './constants';

import { BoardSelectModal } from './modal';
import { TrelloPlugin } from './plugin';
import { take } from 'rxjs/operators';

export class TrelloSettings extends PluginSettingTab {
  private readonly boardSelectModal = new BoardSelectModal(this.plugin.app, this.plugin);
  constructor(
    app: App,
    private readonly plugin: TrelloPlugin
  ) {
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
      this.prepopulateTitleConfigSetting(this.containerEl, settings);
      this.prepopulateDescriptionConfigSetting(this.containerEl, settings);
      this.openInDesktopSetting(this.containerEl, settings);
      this.buildFollowMovedCardsSetting(this.containerEl, settings);
      this.buildMultipleCardsSetting(this.containerEl, settings);
    });
  }

  private async buildTokenSetting(containerEl: HTMLElement, settings: PluginSettings): Promise<void> {
    this.plugin.log(
      'TrelloSettings.buildTokenSetting',
      `-> Adding token setting; token is ${settings.token === '' ? 'not configured' : 'configured'}`
    );
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

  private openInDesktopSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    if (Platform.isMacOS || Platform.isWin) {
      this.plugin.log('TrelloSettings.openInDesktopSetting', '-> Adding open in desktop config setting');
      new Setting(containerEl)
        .setName('Open in Trello desktop')
        .setDesc('Opens cards in Trello desktop application on macOS or Windows')
        .addToggle((toggle) => {
          toggle.setValue(settings.openInDesktop).onChange((value) => {
            this.plugin.state.updateSetting('openInDesktop', value);
          });
        });
    }
  }

  private buildFollowMovedCardsSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildFollowMovedCardsSetting',
      `-> Adding follow moved cards setting with initial value ${settings.followMovedCards}`
    );
    new Setting(containerEl)
      .setName('Follow moved cards')
      .setDesc(
        'Keep notes linked when a card is moved to another board, and update the board stored in the note. If off, a moved card shows an error until it is linked again.'
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.followMovedCards).onChange((value) => {
          this.plugin.state.updateSetting('followMovedCards', value);
        });
      });
  }

  private buildMultipleCardsSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildMultipleCardsSetting',
      `-> Adding multiple cards setting with initial value ${settings.multipleCards}`
    );
    new Setting(containerEl)
      .setName('Multiple cards per note (experimental)')
      .setDesc(
        'Link more than one card to a note. Extra cards are stored in the "trello_cards" property; the first card stays in "trello_board_card_id". If off, only the first card is shown and linking a card replaces it.'
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.multipleCards).onChange((value) => {
          this.plugin.state.updateSetting('multipleCards', value);
          this.plugin.reloadActiveFile();
        });
      });
  }

  private prepopulateTitleConfigSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildConfigSetting',
      `-> Adding prepopulate title setting with initial value ${settings.prepopulateTitle}`
    );
    new Setting(containerEl)
      .setName('Prepopulate Title')
      .setDesc(
        'Populate card title with the note title when creating a new card. Can be overridden when adding a card.'
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.prepopulateTitle).onChange((value) => {
          this.plugin.state.updateSetting('prepopulateTitle', value);
        });
      });
  }

  private prepopulateDescriptionConfigSetting(containerEl: HTMLElement, settings: PluginSettings): void {
    this.plugin.log(
      'TrelloSettings.buildConfigSetting',
      `-> Adding prepopulate description setting with initial value ${settings.prepopulateDescription}`
    );
    new Setting(containerEl)
      .setName('Prepopulate Description')
      .setDesc(
        'Populate card description with the note content when creating a new card. Can be overridden when adding a card.'
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.prepopulateDescription).onChange((value) => {
          this.plugin.state.updateSetting('prepopulateDescription', value);
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
