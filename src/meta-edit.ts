import { Notice, TFile } from 'obsidian';
import { from, Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { TrelloPlugin } from './plugin';
import { MetaEditApi } from './interfaces';
import { LogLevel, TRELLO_ERRORS } from './constants';

export class MetaEditWrapper {
  constructor(private readonly trelloPlugin: TrelloPlugin) {}

  get available(): boolean {
    const available = !!(this.trelloPlugin.app as any).plugins.plugins['metaedit'];
    if (!available) {
      this.trelloPlugin.log('MetaEditWrapper.available', 'MetaEdit not available.', LogLevel.Error);
      new Notice(TRELLO_ERRORS.metaEdit);
    }
    return available;
  }

  get plugin(): MetaEditApi {
    return {
      ...(this.trelloPlugin.app as any).plugins.plugins['metaedit'].api,
      deleteProperty: this.deleteProperty.bind(this)
    };
  }

  /**
   * Add or update a frontmatter key to a given file
   * Make sure not to call this multiple times in a row,
   * updates can get clobbered.
   */
  updateOrCreateMeta(key: string, value: string, file: TFile): Observable<void> {
    return from(this.plugin.getPropertyValue(key, file)).pipe(
      concatMap((existing) => {
        if (existing) {
          this.trelloPlugin.log(
            'MetaEditWrapper.updateOrCreateMeta',
            `Updating existing meta key ${key} with value ${value} in file ${file.name}`
          );
          return from(this.plugin.update(key, value, file));
        } else {
          this.trelloPlugin.log(
            'MetaEditWrapper.updateOrCreateMeta',
            `Adding new meta key ${key} with value ${value} in file ${file.name}`
          );
          return from(this.plugin.createYamlProperty(key, value, file));
        }
      })
    );
  }

  // From https://github.com/chhoumann/MetaEdit/blob/master/src/metaController.ts
  private async deleteProperty(property: string, file: TFile): Promise<void> {
    if (file) {
      const fileContent = await this.trelloPlugin.app.vault.read(file);
      const splitContent = fileContent.split('\n');
      const regexp = new RegExp(`^${property}:`);

      const idx = splitContent.findIndex((s) => s.match(regexp));
      const newFileContent = splitContent
        .filter((_, i) => {
          if (i != idx) return true;
        })
        .join('\n');

      await this.trelloPlugin.app.vault.modify(file, newFileContent);
    }
  }
}
