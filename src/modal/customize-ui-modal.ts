import { App, Modal } from 'obsidian';
import { TrelloPlugin } from '../plugin';

export class CustomizeUIModal extends Modal {
  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app);
  }
}
