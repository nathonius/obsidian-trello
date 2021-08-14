import { App, PluginSettingTab, Setting } from 'obsidian';
import { map, take } from 'rxjs';
import { TrelloPlugin } from './plugin';

export class TrelloSettings extends PluginSettingTab {
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app, plugin);
  }

  async display(): Promise<void> {
    // Prepare container
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Obsidian Trello settings.' });

    // Build settings
    await this.buildTokenSetting(this.containerEl);
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
}
