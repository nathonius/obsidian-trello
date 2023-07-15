import { CardPosition, LeafSide, PluginData, PluginSettings, TrelloCard } from './interfaces';

export enum LogLevel {
  Info,
  Warn,
  Error
}

export const CUSTOM_ICONS = {
  trello: {
    id: 'trello-plugin-icon-trello',
    svgContent:
      '<g><path fill="currentColor" stroke="currentColor" style="stroke:none;fill-rule:nonzero;fill-opacity:1;" d="M 82 8 L 18 8 C 12.480469 8 8 12.480469 8 18 L 8 82 C 8 87.519531 12.480469 92 18 92 L 82 92 C 87.519531 92 92 87.519531 92 82 L 92 18 C 92 12.480469 87.519531 8 82 8 Z M 42 72 C 42 74.199219 40.199219 76 38 76 L 24 76 C 21.800781 76 20 74.199219 20 72 L 20 24 C 20 21.800781 21.800781 20 24 20 L 38 20 C 40.199219 20 42 21.800781 42 24 Z M 80 48 C 80 50.199219 78.199219 52 76 52 L 62 52 C 59.800781 52 58 50.199219 58 48 L 58 24 C 58 21.800781 59.800781 20 62 20 L 76 20 C 78.199219 20 80 21.800781 80 24 Z M 80 48 "/></g>'
  }
};

export const TRELLO_TOKEN_URL =
  'https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Obsidian%20Trello%20Token&key=9537467993aefd6dca9ee7788179c298';
export const TRELLO_API = 'https://api.trello.com';
export const TRELLO_API_KEY = '9537467993aefd6dca9ee7788179c298';
export const TRELLO_VIEW_TYPE = 'trello-plugin';
export const TRELLO_ERRORS = {
  noToken: 'The Trello plugin requires an API token for use. Please visit plugin settings.',
  rateLimit: 'The Trello API is rate limited. Please try again later.',
  unauthorized: 'The Trello API rejected your token. Please create a new token.',
  other: 'The Trello API could not be reached. Please create a new token or try again later.'
};

export const GLOBAL_UI = 'global';
export const DEFAULT_SETTINGS: PluginSettings = {
  token: '',
  customUi: {
    global: {
      checklists: true,
      comments: true,
      description: true,
      labels: true,
      list: true,
      title: true
    }
  },
  selectedBoards: [],
  openToSide: LeafSide.Right,
  newCardPosition: CardPosition.Top,
  movedCardPosition: CardPosition.Top,
  verboseLogging: false
};

export const DEFAULT_DATA: PluginData = {
  settings: DEFAULT_SETTINGS,
  version: '1.6.0',
  firstRun: true,
  connectedCards: {}
};

export enum MetaKey {
  BoardCard = 'trello_board_card_id',
  TrelloId = 'trello_plugin_note_id'
}

export const NEW_TRELLO_CARD: TrelloCard = {
  name: 'Create a new card...',
  id: 'CREATE_NEW_TRELLO_CARD'
} as TrelloCard;
