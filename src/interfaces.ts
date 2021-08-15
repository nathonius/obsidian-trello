// Plugin
export interface PluginData {
  settings: PluginSettings;
}

export interface PluginSettings {
  token: string;
  selectedBoards: string[];
}

// Trello DTO
export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
  softLimit: null | unknown;
  idBoard: string;
  subscribed: boolean;
}
