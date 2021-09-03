import { setIcon } from 'obsidian';

export interface AccordionSection {
  containerEl: HTMLDivElement;
  titleEl: HTMLDivElement;
  titleIcon: HTMLSpanElement;
  contentEl: HTMLDivElement;
  expanded: boolean;
}

const expandedClass = 'trello-accordion--expanded';

export class Accordion {
  readonly sections: AccordionSection[] = [];
  constructor(private readonly parent: HTMLElement, private readonly openOne = true) {}

  addSection(title: string): AccordionSection {
    // Create structure
    const containerEl = this.parent.createDiv('trello-accordion--container');
    const titleEl = containerEl.createDiv('trello-accordion--title');
    titleEl.createSpan({ text: title, cls: 'trello-accordion--title-text' });
    const titleIcon = titleEl.createSpan('trello-accordion--title-icon');
    setIcon(titleIcon, 'left-chevron-glyph');
    const contentEl = containerEl.createDiv('trello-accordion--content');
    const newSection: AccordionSection = { containerEl, titleEl, titleIcon, contentEl, expanded: false };

    // Attach listener
    newSection.titleEl.addEventListener('click', () => {
      if (newSection.expanded) {
        this.collapseSection(newSection);
      } else {
        this.expandSection(newSection);
      }
    });

    this.sections.push(newSection);
    return newSection;
  }

  expandSection(section: AccordionSection): void {
    if (this.openOne) {
      this.sections.forEach((s) => {
        if (s !== section) {
          this.collapseSection(s);
        }
      });
    }
    section.expanded = true;
    section.titleIcon.addClass(expandedClass);
    section.contentEl.style.maxHeight = section.contentEl.scrollHeight + 'px';
  }

  collapseSection(section: AccordionSection): void {
    section.expanded = false;
    section.titleIcon.removeClass(expandedClass);
    section.contentEl.style.maxHeight = '';
  }
}
