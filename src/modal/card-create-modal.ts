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
    const title = this.renderTitle(container);
    const description = this.renderDescription(container);
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

  private renderTitle(parent: HTMLElement): HTMLInputElement {
    return parent.createEl('input', { attr: { placeholder: 'Enter a title for this card...' } });
  }

  private renderDescription(parent: HTMLElement): HTMLTextAreaElement {
    return parent.createEl('textarea', { attr: { placeholder: 'Add a more detailed description...' } });
  }

  private renderLabel(label: TrelloLabel, parent: HTMLElement): void {
    const container = parent.createDiv('trello-card-create--label-container');
    if (label.color) {
      container.classList.add(`trello-color--${label.color}`);
    }
  }

  /**
   * Uses obsidian's toggle styling to create toggle switches for each label
   */
  private buildToggle(label: TrelloLabel, parent: HTMLElement): void {
    const container = parent.createDiv('trello-card-create--toggle-container');

    if (label.color) {
      container.classList.add(`trello-color--${label.color}`);
    }

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
