import { DEFAULT_SETTINGS, GLOBAL_UI } from './constants';
import { PluginData, PluginUISettings } from './interfaces';
import { TrelloPlugin } from './plugin';

export function migrate(plugin: TrelloPlugin, currentData: PluginData): void {
  updateCustomUI(plugin, currentData.settings.customUi);
  plugin.state.updateVersion();
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
