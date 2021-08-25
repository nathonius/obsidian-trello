import { App, Modal } from 'obsidian';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { PluginError, TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from 'src/interfaces';

export class CardCreateModal extends Modal {
  board!: TrelloBoard;
  labels: TrelloLabel[] = [];
  list!: TrelloList;
  createdCard = new Subject<TrelloCard>();

  // New state
  private selectedLabels: Record<string, TrelloLabel> = {};
  private finishedCardCreation = false;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.finishedCardCreation = false;
    this.contentEl.empty();
    const container = this.contentEl.createDiv();
    container.createEl('input', { attr: { placeholder: 'Card name' } });
    container.createEl('textarea', { attr: { placeholder: 'Card description' } });
    const toggleContainer = container.createDiv();
    this.labels.forEach((label) => {
      this.buildToggle(label, toggleContainer);
    });
    const controls = container.createDiv();
    controls.createEl('button', { text: 'Save' });
    controls.createEl('button', { text: 'Cancel' });
  }

  onClose(): void {
    this.selectedLabels = {};
    if (!this.finishedCardCreation) {
      this.createdCard.error(PluginError.Abort);
    }
  }

  /**
   * Uses obsidian's toggle styling to create toggle switches for each label
   */
  private buildToggle(label: TrelloLabel, parent: HTMLElement): void {
    const container = parent.createDiv('trello-card-create--toggle-container');

    container.createDiv({ text: label.name, cls: 'trello-card-create--toggle-label' });
    const toggle = container.createDiv({ cls: 'trello-card-create--toggle checkbox-container' });
    if (this.selectedLabels[label.id]) {
      toggle.classList.add('is-enabled');
    }
    container.addEventListener('click', () => {
      if (this.selectedLabels[label.id]) {
        toggle.classList.remove('is-enabled');
        delete this.selectedLabels[label.id];
      } else {
        toggle.classList.add('is-enabled');
        this.selectedLabels[label.id] = label;
      }
    });
  }
}
