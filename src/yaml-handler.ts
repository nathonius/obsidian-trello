import { EMPTY, Observable, from } from 'rxjs';

import { TFile } from 'obsidian';
import { TrelloPlugin } from './plugin';

export class YamlHandler {
  constructor(private readonly plugin: TrelloPlugin) {}

  getPropertyValue(key: string, file: TFile): string | undefined {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.[key];
  }

  updateOrCreateMeta(key: string, value: string, file: TFile): Observable<void> {
    if (!file) {
      return EMPTY;
    }
    return from(
      this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
        yaml[key] = value;
      })
    );
  }

  async deleteProperty(property: string, file: TFile): Promise<void> {
    if (!file) {
      return;
    }
    return this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
      if (yaml[property] !== undefined) {
        delete yaml[property];
      }
    });
  }
}
