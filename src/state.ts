import { BehaviorSubject, map, Observable, takeUntil } from 'rxjs';
import { DEFAULT_DATA } from './constants';
import {
  PluginConnectedCard,
  PluginData,
  PluginSettings,
  PluginUISettings,
  TrelloAction,
  TrelloCard,
  TrelloChecklist,
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
  readonly checklistCache: TrelloItemCache<TrelloChecklist> = {};
  readonly boardCardId = new BehaviorSubject<string | null>(null);
  readonly connectedCardId = new BehaviorSubject<string | null>(null);
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

  /**
   * Get just the settings from plugin data
   */
  get settings(): Observable<PluginSettings> {
    return this.data.pipe(map((data) => data.settings));
  }

  /**
   * Synchronously get the map of connected cards
   */
  get connectedCards(): Record<string, PluginConnectedCard> {
    return this.data.value.connectedCards;
  }

  /**
   * Update a setting and trigger a save of data
   */
  updateSetting<K extends keyof PluginSettings>(key: K, value: PluginSettings[K]): void {
    const newSettings = { ...this.data.value.settings };
    newSettings[key] = value;
    this.data.next({ ...this.data.value, settings: newSettings });
  }

  /**
   * Update the saved state of connected card
   */
  updateConnectedCard(id: string, value: PluginConnectedCard | null): void {
    const newCards = { ...this.data.value.connectedCards };
    if (value) {
      newCards[id] = value;
    } else {
      delete newCards[id];
    }
    this.data.next({ ...this.data.value, connectedCards: newCards });
  }

  /**
   * Update custom UI settings
   */
  updateCustomUI(id: string, config: PluginUISettings | null): void {
    const newCustomUIConfig = { ...this.data.value.settings.customUi };
    if (config) {
      newCustomUIConfig[id] = config;
    } else {
      delete newCustomUIConfig[id];
    }
    this.updateSetting('customUi', newCustomUIConfig);
  }

  /**
   * Update first run settings
   */
  completedFirstRun(): void {
    this.data.next({ ...this.data.value, firstRun: false });
  }

  /**
   * Set the version in settings to the current value
   */
  updateVersion(): void {
    this.data.next({ ...this.data.value, version: DEFAULT_DATA.version });
  }
}
