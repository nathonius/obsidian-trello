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
export interface TrelloUser {
  id: string;
  // "aaId": "557058:627371a4-163f-446e-b309-eefb81b56828",
  activityBlocked: boolean;
  avatarHash: string | null;
  avatarUrl: string | null;
  // bio: string,
  // "bioData": {
  //     "emoji": {}
  // },
  // confirmed: boolean,
  fullName: string;
  // "idEnterprise": null,
  // "idEnterprisesDeactivated": [],
  idMemberReferrer: string | null;
  // "idPremOrgsAdmin": [],
  initials: string;
  // "memberType": "normal",
  // "nonPublic": {},
  // "nonPublicAvailable": true,
  // "products": [],
  url: string;
  username: string;
  // "status": "disconnected",
  // "aaBlockSyncUntil": null,
  // "aaEmail": null,
  // "aaEnrolledDate": null,
  // "avatarSource": "none",
  // "credentialsRemovedCount": 0,
  // "domainClaimed": null,
  // "email": null,
  // "goldSunsetFreeTrialIdOrganization": null,
  // "gravatarHash": "80c54bc14521e0da50b8401a5660b36e",
  idBoards: string[];
  idOrganizations: string[];
  // "idEnterprisesAdmin": [],
  // "loginTypes": null,
  // "marketingOptIn": {
  //     "optedIn": false,
  //     "date": "2018-04-26T16:14:37.860Z"
  // },
  // "messagesDismissed": [
  //     {
  //         "name": "ad-DirectoryBusinessClassBanner",
  //         "count": 2,
  //         "lastDismissed": "2020-04-02T19:22:13.762Z",
  //         "_id": "5b88556de27f5a536f465267"
  //     },
  //     {
  //         "_id": "5e863a76e3bc57142f6c6149",
  //         "name": "team-join-cta-banner-5c544f5987055f54112f7bc6",
  //         "count": 1,
  //         "lastDismissed": "2020-04-02T19:18:14.419Z"
  //     },
  //     {
  //         "_id": "5e863a76b65a273cac3a60cf",
  //         "name": "team-join-cta-banner-5a465640eca2105f5f3539a2",
  //         "count": 2,
  //         "lastDismissed": "2020-04-02T19:18:14.703Z"
  //     },
  //     {
  //         "_id": "5e863a76732ca03fe1007be0",
  //         "name": "team-join-cta-banner-5a8f04d7d76c3c87039476d0",
  //         "count": 1,
  //         "lastDismissed": "2020-04-02T19:18:14.639Z"
  //     },
  //     {
  //         "_id": "611668bd973a8b86d9d81c61",
  //         "name": "team-join-cta-banner-60c1068289cb9231ebb9f502",
  //         "count": 1,
  //         "lastDismissed": "2021-08-13T12:42:37.155Z"
  //     },
  //     {
  //         "_id": "6116693561d73440dbc90c22",
  //         "name": "ad-logged-in-public-board-5c26ba7c3652131ba57f2654",
  //         "count": 1,
  //         "lastDismissed": "2021-08-13T12:44:37.792Z"
  //     },
  //     {
  //         "_id": "611685f32496d81a4a13f1b2",
  //         "name": "ad-subscribeOnComment",
  //         "count": 2,
  //         "lastDismissed": "2021-08-13T14:47:16.551Z"
  //     }
  // ],
  // "oneTimeMessagesDismissed": [
  //     "GoldEarned",
  //     "OPEN_CARD_TIP",
  //     "simplified-view-full-view",
  //     "simplified-view-org-settings",
  //     "simplified-view-card-activity",
  //     "simplified-view-card-move",
  //     "simplified-view-labels-and-edit",
  //     "close-menu-of-first-board",
  //     "primary-email-hygiene",
  //     "ack-new-feature-AutomaticReports-1633060800000",
  //     "nusku.views-switcher-upsell-default-open",
  //     "teamify-post-migration",
  //     "start-with-a-template",
  //     "60c1068289cb9231ebb9f502-boardMenuMoreCollectionsPromptFull"
  // ],
  // "prefs": {
  //     "privacy": {
  //         "fullName": "public",
  //         "avatar": "public"
  //     },
  //     "sendSummaries": true,
  //     "minutesBetweenSummaries": -1,
  //     "minutesBeforeDeadlineToNotify": 1440,
  //     "colorBlind": false,
  //     "locale": "en-US"
  // },
  // "trophies": [],
  // "uploadedAvatarHash": null,
  // "uploadedAvatarUrl": null,
  // "premiumFeatures": [],
  // "isAaMastered": true,
  // "ixUpdate": "167",
  // "limits": {
  //     "boards": {
  //         "totalPerMember": {
  //             "status": "ok",
  //             "disableAt": 4500,
  //             "warnAt": 4050
  //         }
  //     },
  //     "orgs": {
  //         "totalPerMember": {
  //             "status": "ok",
  //             "disableAt": 850,
  //             "warnAt": 765
  //         }
  //     }
  // }
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
  // closed: boolean;
  // pos: number;
  // softLimit: null | unknown;
  idBoard: string;
  // subscribed: boolean;
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: TrelloLabelColor;
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
  // "closed": boolean,
  dateLastActivity: string;
  desc: string;
  // "descData": null,
  dueReminder: null | number;
  idBoard: string;
  idList: string;
  // "idMembersVoted": string[],
  idShort: number;
  idAttachmentCover: null | string;
  idLabels: string[];
  // "manualCoverAttachment": false,
  name: string;
  // "pos": number,
  shortLink: string;
  // "isTemplate": boolean,
  // "cardRole": null,
  // "badges": Object,
  dueComplete: boolean;
  due: null | string; // Date
  idChecklists: string[];
  // "idMembers": string[],
  labels: TrelloLabel[];
  // "shortUrl": string,
  // "start": null,
  // "subscribed": boolean,
  url: string;
  // "cover": Object
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
  // "appCreator": null,
  // "limits": {
  //     "reactions": {
  //         "perAction": {
  //             "status": "ok",
  //             "disableAt": 1000,
  //             "warnAt": 900
  //         },
  //         "uniquePerAction": {
  //             "status": "ok",
  //             "disableAt": 17,
  //             "warnAt": 16
  //         }
  //     }
  // },
  memberCreator: Pick<
    TrelloUser,
    'id' | 'avatarHash' | 'avatarUrl' | 'fullName' | 'initials' | 'username'
  >;
  // memberCreator: {
  //   id: '5318b0c4192711f669efd793';
  //   activityBlocked: false;
  //   avatarHash: null;
  //   avatarUrl: null;
  //   fullName: 'OfficerHalf';
  //   idMemberReferrer: null;
  //   initials: 'O';
  //   nonPublic: {};
  //   nonPublicAvailable: true;
  //   username: 'officerhalf';
  // };
}
