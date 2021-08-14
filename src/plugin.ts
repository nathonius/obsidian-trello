import { Plugin } from 'obsidian';
import { Subject } from 'rxjs';
import { TrelloAPI } from './api';
import { DEFAULT_DATA } from './constants';
import { PluginData } from './interfaces';

import { TrelloSettings } from './settings';
import { PluginState } from './state';

export class TrelloPlugin extends Plugin {
  api!: TrelloAPI;
  state!: PluginState;
  destroy = new Subject<void>();

  async onload() {
    const savedData: PluginData | undefined = await this.loadData();
    this.state = new PluginState(this, savedData || DEFAULT_DATA);
    this.api = new TrelloAPI(this);

    // Add settings
    this.addSettingTab(new TrelloSettings(this.app, this));

    this.addCommand({
      id: 'trello-list-boards',
      name: 'List trello boards',
      callback: () => {
        this.api.getBoards().subscribe((resp) => {
          console.log(resp.response);
        });
      }
    });
  }

  onunload() {
    this.destroy.next();
    this.destroy.complete();
  }
}
