import { CUSTOM_ICONS, TRELLO_ERRORS, TRELLO_VIEW_TYPE } from '../constants';
import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf, setIcon, Platform } from 'obsidian';
import {
  PluginError,
  PluginUISettings,
  TrelloAction,
  TrelloCard,
  TrelloCheckItem,
  TrelloCheckItemState,
  TrelloChecklist,
  TrelloList
} from '../interfaces';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

import { Accordion } from '../accordion/accordion';
import { TrelloPlugin } from '../plugin';
import { TrelloViewManager } from './view-manager';

export class TrelloView extends ItemView {
  private readonly destroy = new Subject<void>();
  private readonly update = new Subject<void>();
  private readonly viewManager = new TrelloViewManager(this.plugin, this.destroy, this.update);

  constructor(private readonly plugin: TrelloPlugin, leaf: WorkspaceLeaf) {
    super(leaf);

    // Re-render whenever state changes
    combineLatest([
      this.viewManager.currentCard,
      this.viewManager.currentActions,
      this.viewManager.currentList,
      this.viewManager.currentChecklists,
      this.viewManager.currentUIConfig
    ])
      .pipe(takeUntil(this.destroy))
      .subscribe(([card, actions, list, checklists, uiConfig]) => {
        this.contentEl.empty();
        const errors = [this.viewManager.cardError, this.viewManager.actionsError, this.viewManager.listError];
        if (errors.some((err) => err !== null)) {
          this.renderEmptyView(this.getWorstError(errors));
        } else if (card === null) {
          this.renderEmptyView(null);
        } else {
          this.renderConnectedView(card, actions, list, checklists, uiConfig);
        }
      });
  }

  getDisplayText(): string {
    return 'Trello';
  }

  getViewType(): string {
    return TRELLO_VIEW_TYPE;
  }

  getIcon(): string {
    return CUSTOM_ICONS.trello.id;
  }

  onunload(): void {
    this.destroy.next();
    this.destroy.complete();
  }

  /**
   * Force a refresh of the current card
   */
  updateCard(): void {
    this.update.next();
  }

  private renderPaneContainer(): HTMLDivElement {
    return this.contentEl.createDiv('trello-pane--container');
  }

  /**
   * Renders a view for when there is no token, no card, or any errors occurred.
   */
  private renderEmptyView(error: PluginError | null) {
    this.plugin.log('TrelloView.renderEmptyView', '');
    const pane = this.renderPaneContainer();
    if (error === null || error === PluginError.NoToken) {
      pane.createEl('h2', { text: 'No Trello card connected.' });
      if (error === PluginError.NoToken) {
        pane.createDiv({ text: 'An API token is required.' });
        const tokenButton = pane.createEl('button', {
          text: 'Setup Trello',
          attr: { type: 'button' }
        });
        tokenButton.addEventListener('click', () => {
          this.plugin.openTrelloSettings();
        });
      } else {
        const connectButton = pane.createEl('button', {
          text: 'Connect Trello Card',
          attr: { type: 'button' }
        });
        connectButton.addEventListener('click', () => {
          this.plugin.connectTrelloCard();
        });
      }
    } else {
      pane.createEl('h2', { text: 'Could not reach Trello API.' });
      if (error === PluginError.RateLimit) {
        pane.createDiv({ text: TRELLO_ERRORS.rateLimit });
      } else if (error === PluginError.Unauthorized) {
        pane.createDiv({ text: TRELLO_ERRORS.unauthorized });
        const tokenButton = pane.createEl('button', {
          text: 'Setup Trello',
          attr: { type: 'button' }
        });
        tokenButton.addEventListener('click', () => {
          this.plugin.openTrelloSettings();
        });
      } else {
        pane.createDiv({ text: TRELLO_ERRORS.other });
      }
    }
  }

  /**
   * After getting all data, render it into a usable form.
   */
  private renderConnectedView(
    card: TrelloCard,
    actions: TrelloAction[] | null,
    list: TrelloList | null,
    checklists: TrelloChecklist[] | null,
    uiConfig: PluginUISettings | null
  ): void {
    this.plugin.log('TrelloView.renderConnectedView', '');
    this.renderHeader(this.contentEl);
    const pane = this.renderPaneContainer();

    if (uiConfig?.list || uiConfig?.title || uiConfig?.description) {
      const cardInfo = pane.createDiv('trello-pane--card-info');

      if (uiConfig?.list && list) {
        this.renderCardList(list, cardInfo);
      }

      if (uiConfig.title) {
        this.renderCardTitle(card, cardInfo);
      }

      if (uiConfig.description && card.desc) {
        this.renderCardDesc(card, cardInfo);
      }

      if (uiConfig.due) {
        this.renderCardDue(card, cardInfo);
      }
    }

    if (uiConfig?.labels && card.labels && card.labels.length > 0) {
      const labelSectionContainer = pane.createDiv('trello-pane--label-section');
      this.renderLabels(card, labelSectionContainer);
    }

    if (uiConfig?.comments) {
      const commentSectionContainer = pane.createDiv('trello-pane--comment-section');
      this.renderCommentSection(card, actions, commentSectionContainer);
    }

    if (uiConfig?.checklists && checklists && checklists.length > 0) {
      const checklistSectionContainer = pane.createDiv('trello-pane--checklist-section');
      this.renderChecklistSection(card.id, checklists, checklistSectionContainer);
    }
  }

  /**
   * Renders the controls above the card info.
   */
  private renderHeader(parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderHeader', '');
    const header = parent.createDiv('nav-header');
    const buttons = header.createDiv('nav-buttons-container');
    this.renderNavButton(buttons, 'Refresh card', 'reset', () => {
      this.update.next();
    });
    this.renderNavButton(buttons, 'Link another card', 'link', () => {
      this.plugin.connectTrelloCard();
    });
    this.renderNavButton(buttons, 'Unlink card', 'trash', () => {
      this.plugin.disconnectTrelloCard();
    });
    this.renderNavButton(buttons, 'Customize UI', 'gear', () => {
      this.plugin.customizeUIModal.source.next(this.viewManager.connectedId.value);
      this.plugin.customizeUIModal.open();
    });
  }

  /**
   * Renders the name of the list which can be used to move the card to another list
   */
  private renderCardList(list: TrelloList, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderCardList', '');
    const listName = parent.createEl('a', {
      cls: 'trello-pane--card-info--list',
      text: list.name,
      attr: {
        'aria-label': 'Move card',
        href: '#'
      }
    });
    const listIcon = listName.createSpan();
    setIcon(listIcon, 'right-arrow-with-tail');
    listName.addEventListener('click', () => {
      this.viewManager.moveCard();
    });
  }

  /**
   * Renders the name of the card
   */
  private renderCardTitle(card: TrelloCard, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderCardTitle', '');
    const cardName = parent.createEl('h3', { text: card.name });

    let cardLink = card.url;
    let cardLinkEl = HTMLAnchorElement.prototype;

    if (this.plugin.state.getSetting('openInDesktop') === true) {
      cardLink = card.url.replace('https', 'trello');
    }
    if (Platform.isMacOS || Platform.isWin) {
      cardLinkEl = cardName.createEl('a', {
        attr: { href: cardLink, 'aria-label': 'View in Trello Desktop' }
      });
    } else {
      cardLinkEl = cardName.createEl('a', {
        attr: { href: cardLink, 'aria-label': 'View on Trello' }
      });
    }
    setIcon(cardLinkEl, 'navigate-glyph');
  }

  /**
   * Renders the card description.
   */
  private renderCardDesc(card: TrelloCard, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderCardDesc', '');
    const descContainer = parent.createDiv('trello-card-desc--container');
    const collapseButton = descContainer.createEl('a', {
      text: 'Description',
      cls: 'trello-card-desc--collapse',
      href: '#'
    });
    const collapseIcon = collapseButton.createSpan('trello-card-desc--collapse-icon');
    setIcon(collapseIcon, 'down-chevron-glyph');
    const description = descContainer.createDiv({ cls: 'trello-card-desc--desc' });
    MarkdownRenderer.renderMarkdown(card.desc, description, '', this);
    collapseButton.addEventListener('click', () => {
      if (description.style.maxHeight) {
        description.style.maxHeight = '';
        setIcon(collapseIcon, 'down-chevron-glyph');
      } else {
        description.style.maxHeight = description.scrollHeight + 'px';
        setIcon(collapseIcon, 'up-chevron-glyph');
      }
    });
  }

  /**
   * Renders the due date of the card
   */
  private renderCardDue(card: TrelloCard, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderCardDue', '');
    if (card.due) {
      const dueDate = new Date(card.due);
      parent.createEl('h3', {
        text: `Due: ${dueDate.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`
      });
    } else {
      parent.createEl('h3', { text: 'No due date' });
    }
  }

  /**
   * Render the colored labels.
   */
  private renderLabels(card: TrelloCard, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderLabels', '');
    card.labels.forEach((label) => {
      if (label.color) {
        const wrapper = parent.createDiv({
          cls: `trello-label-wrapper`,
          attr: { 'aria-label': label.name !== '' ? label.name : null }
        });
        wrapper.createSpan({
          cls: `trello-label trello-color--${label.color}`
        });
      }
    });
  }

  /**
   * Renders the comment section and input to add new comments.
   */
  private renderCommentSection(card: TrelloCard, comments: TrelloAction[] | null, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderCommentSection', '');
    const container = parent.createDiv('trello-comment-input--container');

    // Small hack for auto-resizing textarea
    // See: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
    const inputContainer = container.createDiv({
      cls: 'trello-comment-input--input-container'
    });
    const input = inputContainer.createEl('textarea', {
      cls: 'trello-comment-input--input',
      attr: {
        onInput: 'this.parentNode.dataset.replicatedValue = this.value',
        placeholder: 'Write a comment...'
      }
    });
    const button = container.createEl('button', {
      cls: 'trello-comment-input--submit',
      text: 'Submit',
      attr: { type: 'button' }
    });
    button.addEventListener('click', () => {
      if (input.value) {
        this.plugin.api
          .addCommentToCard(card.id, input.value)
          .pipe(
            tap(() => {
              input.value = '';
            })
          )
          .subscribe(() => {
            this.update.next();
            new Notice('Added comment.');
          });
      }
    });
    if (comments && comments.length !== 0) {
      comments.forEach((a) => {
        this.renderComment(a, parent);
      });
    }
  }

  /**
   * Render an individual comment.
   */
  private renderComment(comment: TrelloAction, parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderComment', '');
    const commentContainer = parent.createDiv('trello-comment--container');
    const commentMetadata = commentContainer.createDiv('trello-comment--metadata');
    commentMetadata.createSpan({
      text: comment.memberCreator.fullName,
      cls: 'trello-comment--creator'
    });
    commentMetadata.createSpan({
      text: new Date(comment.date).toLocaleString(),
      cls: 'trello-comment--date'
    });
    const textContainer = commentContainer.createDiv('trello-comment--text-container');
    MarkdownRenderer.renderMarkdown(comment.data.text, textContainer, '', this);
  }

  /**
   * Render the checklist section
   */
  private renderChecklistSection(cardId: string, checklists: TrelloChecklist[], parent: HTMLElement): void {
    this.plugin.log('TrelloView.renderChecklistSection', '');
    const checklistSection = parent.createDiv('trello-checklist--section');
    const accordion = new Accordion(checklistSection);
    checklists.forEach((checklist) => {
      this.renderChecklist(cardId, checklist, accordion);
    });
  }

  /**
   * Render an individual checklist
   */
  private renderChecklist(cardId: string, checklist: TrelloChecklist, accordion: Accordion): void {
    this.plugin.log('TrelloView.renderChecklist', '');
    // Create accordion section
    const section = accordion.addSection(checklist.name);

    // Add progress to accordion title
    const titleText = section.titleEl.querySelector('.trello-accordion--title-text') as HTMLElement;
    const titlePercent = titleText?.createSpan({ cls: 'trello-checklist--accordion-percent' });

    // Create progress bar
    const progressContainer = section.contentEl.createDiv('trello-checklist--progress-container');
    const progressPercent = progressContainer.createSpan('trello-checklist--progress-percent');
    const progress = progressContainer.createEl('progress', {
      cls: 'trello-checklist--progress',
      attr: {
        max: 100
      }
    });

    // Set progress values
    this.updateProgress(checklist.checkItems, progress, progressPercent, titlePercent);

    // Create list
    const checklistContainer = section.contentEl.createEl('ul', 'trello-checklist--checklist');
    checklist.checkItems.forEach((i, index) => {
      const itemId = `checkitem-${i.id}`;
      const item = checklistContainer.createEl('li', 'trello-checklist--checkitem');

      // Add checkbox and label
      const checkbox = item.createEl('input', {
        cls: 'trello-checklist--checkitem-input',
        attr: { type: 'checkbox', id: itemId }
      });
      checkbox.checked = i.state === TrelloCheckItemState.Complete;
      checkbox.addEventListener('change', (event) => {
        event.preventDefault();
        let state: TrelloCheckItemState = TrelloCheckItemState.Complete;
        if (!checkbox.checked) {
          state = TrelloCheckItemState.Incomplete;
        }
        this.plugin.api.updateCheckItemState(cardId, i.id, state).subscribe((result) => {
          // Update checkbox and progress
          checkbox.checked = result.state === TrelloCheckItemState.Complete;
          const newCheckItems = [...checklist.checkItems];
          newCheckItems[index].state = result.state;
          this.updateProgress(newCheckItems, progress, progressPercent, titlePercent);
          // Just remove the list from the cache, no need to re-render
          delete this.plugin.state.listCache[checklist.id];
        });
      });
      item.createEl('label', { cls: 'trello-checklist--checkitem-label', text: i.name, attr: { for: itemId } });
    });
  }

  /**
   * Render a specific header button.
   */
  private renderNavButton(parent: HTMLElement, label: string, icon: string, callback: () => void): void {
    this.plugin.log('TrelloView.renderNavButton', '');
    const button = parent.createDiv({
      cls: 'nav-action-button',
      attr: { 'aria-label': label }
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
  }

  /**
   * Returns the worst error of the given errors.
   * Error heirarchy is (worst to best):
   * 1. Rate limit
   * 2. Unauthorized
   * 3. Unknown
   * 4. No token
   */
  private getWorstError(errors: Array<PluginError | null>): PluginError | null {
    this.plugin.log('TrelloView.getWorstError', '');
    let worstError: PluginError | null = null;
    errors.forEach((err) => {
      switch (worstError) {
        case null:
        case PluginError.NoToken:
          if (err !== null) {
            worstError = err;
          }
          break;
        case PluginError.RateLimit:
          if (err === PluginError.Unauthorized) {
            worstError = err;
          }
          break;
      }
    });
    return worstError;
  }

  /**
   * Given an array of checkItems, set the progress values on
   * - a given progress element
   * - a span (as a %)
   * - an element (as a fraction)
   */
  private updateProgress(
    checkItems: TrelloCheckItem[],
    progress: HTMLProgressElement,
    percent: HTMLSpanElement,
    titlePercent: HTMLElement
  ): void {
    this.plugin.log('TrelloView.updateProgress', '');
    const completeItems = checkItems.filter((i) => i.state === TrelloCheckItemState.Complete);
    const progressPercent = checkItems.length > 0 ? Math.round((completeItems.length / checkItems.length) * 100) : 0;
    progress.value = progressPercent;
    percent.innerText = `${progressPercent}%`;
    titlePercent.innerText = `(${completeItems.length}/${checkItems.length})`;
  }
}
