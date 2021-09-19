import { App, Modal, Setting } from 'obsidian';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { PluginUISettings } from 'src/interfaces';
import { GLOBAL_UI } from '../constants';
import { TrelloPlugin } from '../plugin';

export class CustomizeUIModal extends Modal {
  source = new BehaviorSubject<string | null>(null);
  newState!: PluginUISettings;
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app);

    combineLatest({
      customUi: this.plugin.state.settings.pipe(
        takeUntil(this.plugin.destroy),
        map((s) => s.customUi)
      ),
      source: this.source.pipe(
        filter((s) => s !== null),
        takeUntil(this.plugin.destroy)
      )
    })
      .pipe(
        map(({ customUi, source }) => {
          if (customUi[source as string]) {
            this.plugin.log('CustomizeUIModal', `Customizing ui config for trello ID ${source}`);
            return customUi[source as string];
          }
          this.plugin.log('CustomizeUIModal', 'Customizing global UI config');
          return customUi[GLOBAL_UI];
        })
      )
      .subscribe((settings) => {
        this.plugin.log('CustomizeUIModal', 'Building Customize UI modal');
        const source = this.source.value;
        this.contentEl.empty();
        this.newState = { ...settings };

        // Build settings
        new Setting(this.contentEl).setName('Title').addToggle((toggle) => {
          toggle.setValue(settings.title).onChange((value) => (this.newState.title = value));
        });
        new Setting(this.contentEl).setName('Description').addToggle((toggle) => {
          toggle.setValue(settings.description).onChange((value) => (this.newState.description = value));
        });
        new Setting(this.contentEl).setName('List').addToggle((toggle) => {
          toggle.setValue(settings.list).onChange((value) => (this.newState.list = value));
        });
        new Setting(this.contentEl).setName('Comments').addToggle((toggle) => {
          toggle.setValue(settings.comments).onChange((value) => (this.newState.comments = value));
        });
        new Setting(this.contentEl).setName('Labels').addToggle((toggle) => {
          toggle.setValue(settings.labels).onChange((value) => (this.newState.labels = value));
        });
        const controls = this.contentEl.createDiv();
        if (source !== GLOBAL_UI) {
          const resetButton = controls.createEl('button', { text: 'Reset to Default' });
          resetButton.addEventListener('click', () => {
            this.plugin.log('CustomizeUIModal', `Resetting UI config for trello ID ${source}`);
            this.plugin.state.updateCustomUI(source as string, null);
            this.plugin.view.updateCard();
            this.close();
          });
        }
        const saveButton = controls.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveButton.addEventListener('click', () => {
          this.plugin.log('CustomizeUIModal', `Saving UI config for trello ID ${source}`);
          this.plugin.state.updateCustomUI(source as string, this.newState);
          this.close();
        });
      });
  }
}
