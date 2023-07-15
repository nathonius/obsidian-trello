import { TFile } from 'obsidian';

// Plugin
export interface PluginData {
  settings: PluginSettings;
  version: string;
  firstRun: boolean;
  connectedCards: Record<string, PluginConnectedCard>;
}

export interface PluginUISettings {
  checklists: boolean;
  comments: boolean;
  description: boolean;
  labels: boolean;
  list: boolean;
  title: boolean;
}

export interface PluginSettings {
  token: string;
  customUi: Record<string, PluginUISettings>;
  selectedBoards: TrelloBoard[];
  openToSide: LeafSide;
  newCardPosition: CardPosition;
  movedCardPosition: CardPosition;
  verboseLogging: boolean;
}

export enum PluginError {
  NoToken = 'NoToken',
  Unauthorized = 'Unauthorized',
  RateLimit = 'RateLimit',
  Unknown = 'Unknown',
  Abort = 'Abort'
}

export interface PluginConnectedCard {
  boardId: string;
  cardId: string;
}

export enum LeafSide {
  Left = 'left',
  Right = 'right'
}

export type TrelloItemCache<T> = Record<string, { item: T; timestamp: Date }>;

// Trello DTO
export interface TrelloUser {
  id: string;
  activityBlocked: boolean;
  avatarHash: string | null;
  avatarUrl: string | null;
  fullName: string;
  idMemberReferrer: string | null;
  initials: string;
  url: string;
  username: string;
  idBoards: string[];
  idOrganizations: string[];
}
export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  url: string;
  shortLink: string;
  labelNames: Record<TrelloLabelColor, string>;
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: TrelloLabelColor | null;
}

export interface TrelloCard {
  id: string;
  checkItemStates:
    | null
    | [
        {
          idCheckItem: string;
          state: TrelloCheckItemState;
        }
      ];
  dateLastActivity: string;
  desc: string;
  dueReminder: null | number;
  idBoard: string;
  idList: string;
  idShort: number;
  idAttachmentCover: null | string;
  idLabels: string[];
  name: string;
  shortLink: string;
  dueComplete: boolean;
  due: null | string; // Date
  idChecklists: string[];
  labels: TrelloLabel[];
  url: string;
  pos: number | 'top' | 'bottom';
}

export enum TrelloActionType {
  Comment = 'commentCard'
}

export enum TrelloCheckItemState {
  Complete = 'complete',
  Incomplete = 'incomplete'
}

export enum TrelloLabelColor {
  Green = 'green',
  Yellow = 'yellow',
  Orange = 'orange',
  Red = 'red',
  Purple = 'purple',
  Blue = 'blue',
  Sky = 'sky',
  Lime = 'lime',
  Pink = 'pink',
  Black = 'black'
}

export interface TrelloAction {
  id: string;
  idMemberCreator: string;
  data: {
    text: string;
    card: Pick<TrelloCard, 'id' | 'name' | 'idShort' | 'shortLink'>;
    board: Pick<TrelloBoard, 'id' | 'name' | 'shortLink'>;
    list: Pick<TrelloList, 'id' | 'name'>;
  };
  type: TrelloActionType;
  date: string;
  memberCreator: Pick<TrelloUser, 'id' | 'avatarHash' | 'avatarUrl' | 'fullName' | 'initials' | 'username'>;
}

export enum CardPosition {
  Top = 'top',
  Bottom = 'bottom'
}

export interface NewCardRequest {
  name?: string;
  desc?: string;
  pos?: CardPosition;
  idList: string;
  idLabels?: string[];
}

export interface TrelloCheckItem {
  idChecklist: string;
  state: TrelloCheckItemState;
  id: string;
  name: string;
  nameData: null | any; // unknown
  pos: number;
  due: null | string; // Date
  // "idMember": null
}

export interface TrelloChecklist {
  id: string;
  name: string;
  idCard: string;
  pos: number;
  idBoard: string;
  checkItems: TrelloCheckItem[];
}
