import { App, Modal } from 'obsidian';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from 'src/interfaces';

export class CardCreateModal extends Modal {
  board!: TrelloBoard;
  labels: TrelloLabel[] = [];
  list!: TrelloList;
  createdCard = new Subject<TrelloCard>();
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    // TODO: Render all the fields with all the stuff
  }

  onClose(): void {
    // TODO: Reset everything on close
  }
}
