import { BehaviorSubject, map, Observable, takeUntil } from 'rxjs';
import {
  PluginData,
  PluginSettings,
  TrelloAction,
  TrelloCard,
  TrelloItemCache,
  TrelloLabel,
  TrelloList
} from './interfaces';
import { TrelloPlugin } from './plugin';

export class PluginState {
  private readonly data: BehaviorSubject<PluginData>;
  readonly cardCache: TrelloItemCache<TrelloCard> = {};
  readonly cardActionsCache: TrelloItemCache<TrelloAction[]> = {};
  readonly listCache: TrelloItemCache<TrelloList> = {};
  readonly labelCache: TrelloItemCache<TrelloLabel[]> = {};
  readonly boardCardId = new BehaviorSubject<string | null>(null);
  readonly currentToken = new BehaviorSubject<string>('');
  readonly verboseLogging = new BehaviorSubject<boolean>(false);

  constructor(private readonly plugin: TrelloPlugin, data: PluginData) {
    // Initialize data
    this.data = new BehaviorSubject<PluginData>(data);

    // Update saved data when data changes
    this.data.pipe(takeUntil(plugin.destroy)).subscribe(async (newData) => {
      await this.plugin.saveData(newData);
    });
  }

  get settings(): Observable<PluginSettings> {
    return this.data.pipe(map((data) => data.settings));
  }

  updateSetting<K extends keyof PluginSettings>(key: K, value: PluginSettings[K]): void {
    const newSettings = { ...this.data.value.settings };
    newSettings[key] = value;
    this.data.next({ ...this.data.value, settings: newSettings });
  }

  completedFirstRun(): void {
    this.data.next({ ...this.data.value, firstRun: false });
  }
}
