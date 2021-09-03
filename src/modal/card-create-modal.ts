import { App, Modal, setIcon } from 'obsidian';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Accordion } from '../accordion/accordion';
import { CardPosition, PluginError, TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from 'src/interfaces';
import { TrelloPlugin } from '../plugin';

/**
 * Create a new card and update createdCard
 * Board, labels, list, and default position should all be set
 * before opening the modal.
 */
export class CardCreateModal extends Modal {
  board!: TrelloBoard;
  labels: TrelloLabel[] = [];
  list!: TrelloList;
  defaultPosition!: CardPosition;
  createdCard = new Subject<TrelloCard>();

  // New state
  private selectedLabels: Record<string, TrelloLabel> = {};
  private title!: HTMLInputElement;
  private description!: HTMLTextAreaElement;
  private position!: HTMLSelectElement;
  private finishedCardCreation = false;

  constructor(app: App, private readonly plugin: TrelloPlugin) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv();
    this.title = this.renderTitle(container);
    const accordion = new Accordion(container);
    const descriptionSection = accordion.addSection('Description');
    const labelsSection = accordion.addSection('Labels');
    this.description = this.renderDescription(descriptionSection.contentEl);
    this.renderLabels(labelsSection.contentEl);
    this.position = this.renderPositionSelect(container);
    const controls = container.createDiv('trello-card-create--controls');
    const saveButton = controls.createEl('button', { text: 'Save', cls: 'mod-cta' });
    saveButton.addEventListener('click', this.onSave.bind(this));
    const cancelButton = controls.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', this.close.bind(this));
  }

  onClose(): void {
    if (!this.finishedCardCreation) {
      this.createdCard.error(PluginError.Abort);
    }
    this.reset();
  }

  private onSave(): void {
    this.plugin.api
      .addNewCard({
        idList: this.list.id,
        idLabels: Object.values(this.selectedLabels).map((label) => label.id),
        name: this.title.value,
        desc: this.description.value,
        pos: this.position.value as CardPosition
      })
      .pipe(map((resp) => resp.response))
      .subscribe({
        next: (card) => {
          // New card was created
          this.finishedCardCreation = true;
          this.createdCard.next(card);
          this.close();
        },
        error: (err: PluginError) => {
          // Pass error through
          this.finishedCardCreation = true;
          this.createdCard.error(err);
        }
      });
  }

  private reset(): void {
    this.selectedLabels = {};
    this.createdCard = new Subject<TrelloCard>();
    this.title.value = '';
    this.description.value = '';
    this.finishedCardCreation = false;
  }

  private renderTitle(parent: HTMLElement): HTMLInputElement {
    return parent.createEl('input', {
      cls: 'trello-card-create--title',
      attr: { placeholder: 'Enter a title for this card...' }
    });
  }

  private renderDescription(parent: HTMLElement): HTMLTextAreaElement {
    const wrapper = parent.createDiv('trello-card-create--desc-wrapper');
    // Small hack for auto-resizing textarea
    // See: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
    const descContainer = wrapper.createDiv({
      cls: 'trello-card-create--desc-container'
    });
    const desc = descContainer.createEl('textarea', {
      cls: 'trello-card-create--desc',
      attr: {
        onInput: 'this.parentNode.dataset.replicatedValue = this.value',
        placeholder: 'Add a more detailed description...'
      }
    });
    return desc;
  }

  private renderLabels(parent: HTMLElement): void {
    // Create container
    const labelsContainer = parent.createDiv('trello-card-create--labels');

    // Add each label option to the container
    this.labels.forEach((label) => {
      this.renderLabel(label, labelsContainer);
    });
  }

  private renderLabel(label: TrelloLabel, parent: HTMLElement): void {
    const container = parent.createDiv('trello-card-create--label-container');
    if (label.color) {
      container.addClass(`label-color--${label.color}`);
    } else {
      container.addClass('label-color--grey');
    }
    container.createSpan({ text: label.name, cls: 'trello-card-create--label-name' });

    this.buildCheck(label, container);
  }

  private buildCheck(label: TrelloLabel, parent: HTMLElement): void {
    const check = parent.createSpan({ cls: 'trello-card-create--check' });
    parent.addEventListener('click', () => {
      if (this.selectedLabels[label.id]) {
        check.empty();
        delete this.selectedLabels[label.id];
      } else {
        setIcon(check, 'checkbox-glyph', 20);
        this.selectedLabels[label.id] = label;
      }
    });
  }

  private renderPositionSelect(parent: HTMLElement): HTMLSelectElement {
    const container = parent.createDiv('trello-card-create--position-select-container');
    container.createEl('label', {
      text: 'Add new card to',
      attr: { for: 'trello-card-create--position-select' }
    });
    const select = container.createEl('select', {
      cls: 'dropdown',
      attr: { id: 'trello-card-create--position-select' }
    });
    select.createEl('option', { text: 'Top', attr: { value: CardPosition.Top } });
    select.createEl('option', { text: 'Bottom', attr: { value: CardPosition.Bottom } });
    select.value = this.defaultPosition;
    return select;
  }
}
