import { TFile } from 'obsidian';

// Plugin
export interface PluginData {
  settings: PluginSettings;
}

export interface PluginSettings {
  token: string;
  selectedBoards: TrelloBoard[];
}

// 3rd Party
export interface MetaEditApi {
  createYamlProperty: (
    propertyName: string,
    propertyValue: string,
    file: TFile | string
  ) => Promise<void>;
  update: (
    propertyName: string,
    propertyValue: string,
    file: TFile | string
  ) => Promise<void>;
  getPropertyValue: (
    propertyName: string,
    file: TFile | string
  ) => Promise<string | undefined>;
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
  // closed: boolean;
  // pos: number;
  // softLimit: null | unknown;
  idBoard: string;
  // subscribed: boolean;
}

export interface TrelloCard {
  id: string;
  // "checkItemStates": null,
  // "closed": boolean,
  dateLastActivity: string;
  desc: string;
  // "descData": null,
  // "dueReminder": null,
  idBoard: string;
  // "idList": string,
  // "idMembersVoted": string[],
  // "idShort": number,
  // "idAttachmentCover": null,
  // "idLabels": string[],
  // "manualCoverAttachment": false,
  name: string;
  // "pos": number,
  // "shortLink": string,
  // "isTemplate": boolean,
  // "cardRole": null,
  // "badges": Object,
  // "dueComplete": boolean,
  // "due": null,
  // "idChecklists": string[],
  // "idMembers": string[],
  // "labels": any[],
  // "shortUrl": string,
  // "start": null,
  // "subscribed": boolean,
  url: string;
  // "cover": Object
}
