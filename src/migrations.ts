import { DEFAULT_SETTINGS, GLOBAL_UI } from './constants';
import { PluginData, PluginUISettings } from './interfaces';
import { TrelloPlugin } from './plugin';

export const migrations: Record<string, (plugin: TrelloPlugin, currentData: PluginData) => void> = {
  '1.0.0': v1_0_0__1_3_2,
  '1.1.0': v1_0_0__1_3_2,
  '1.2.0': v1_0_0__1_3_2,
  '1.3.0': v1_0_0__1_3_2,
  '1.3.1': v1_0_0__1_3_2,
  '1.3.2': v1_0_0__1_3_2
};

/**
 * How migrations work:
 * Each function should take all the necessary steps to migrate from
 * that version (ex: 1.0.0) to the current version. If there are new
 * features added or breaking changes made, ALL previous migration
 * methods should be updated.
 *
 * At the very least, the version data should be updated to the
 * current version so that migrations are only executed once.
 */

// Migrate any version from 1.0.0-1.3.2 to current
function v1_0_0__1_3_2(plugin: TrelloPlugin, currentData: PluginData): void {
  plugin.state.updateVersion();
  updateCustomUI(plugin, currentData.settings.customUi);
}

// Add any new properties to all custom UI configs
function updateCustomUI(plugin: TrelloPlugin, customUi: Record<string, PluginUISettings>): void {
  const defaultUi = DEFAULT_SETTINGS.customUi[GLOBAL_UI];
  const newCustomUi = { ...customUi };
  Object.keys(customUi).forEach((k) => {
    newCustomUi[k] = Object.assign({}, defaultUi, customUi[k]);
  });
  plugin.state.updateSetting('customUi', newCustomUi);
}
