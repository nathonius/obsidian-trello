import { PluginData, PluginSettings } from './interfaces';

export const TRELLO_API = 'https://api.trello.com';
export const TRELLO_API_KEY = '9537467993aefd6dca9ee7788179c298';

export const DEFAULT_SETTINGS: PluginSettings = {
  token: '',
  selectedBoards: []
};

export const DEFAULT_DATA: PluginData = {
  settings: DEFAULT_SETTINGS
};
