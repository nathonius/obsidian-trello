import { EMPTY, Observable, from } from 'rxjs';

import { CardRef } from './interfaces';
import { MetaKey } from './constants';
import { TFile } from 'obsidian';
import { TrelloPlugin } from './plugin';

// Trello object IDs are alphanumeric. Anything else in frontmatter is ignored rather than put in a URL.
const ID_PATTERN = /^[0-9a-zA-Z]{8,32}$/;

export function parseCardRef(value: unknown): CardRef | null {
  if (typeof value !== 'string') {
    return null;
  }
  const [boardId, cardId, ...rest] = value.split(';');
  if (rest.length > 0 || !ID_PATTERN.test(boardId ?? '') || !ID_PATTERN.test(cardId ?? '')) {
    return null;
  }
  return { boardId, cardId };
}

export function formatCardRef(ref: CardRef): string {
  return `${ref.boardId};${ref.cardId}`;
}

export class YamlHandler {
  constructor(private readonly plugin: TrelloPlugin) {}

  getPropertyValue(key: string, file: TFile): string | undefined {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.[key];
  }

  /**
   * All cards linked to a note. The multiple cards setting decides whether
   * the extra cards list is read, otherwise only the first card is returned.
   */
  getCardRefs(file: TFile): CardRef[] {
    const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    const extra = frontmatter?.[MetaKey.Cards];
    return this.parseCardRefs(
      frontmatter?.[MetaKey.BoardCard],
      this.plugin.state.getSetting('multipleCards') ? extra : undefined
    );
  }

  private parseCardRefs(primary: unknown, extra: unknown): CardRef[] {
    const values = [primary, ...(Array.isArray(extra) ? extra : [])];
    const refs: CardRef[] = [];
    values.forEach((value) => {
      const ref = parseCardRef(value);
      if (ref && !refs.some((existing) => existing.cardId === ref.cardId)) {
        refs.push(ref);
      }
    });
    return refs;
  }

  updateOrCreateMeta(key: string, value: string, file: TFile): Observable<void> {
    if (!file) {
      return EMPTY;
    }
    return from(
      this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
        yaml[key] = value;
      })
    );
  }

  /**
   * Append a card to the extra cards list.
   */
  addCardRef(ref: CardRef, file: TFile): Observable<void> {
    return from(
      this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
        const existing = Array.isArray(yaml[MetaKey.Cards]) ? yaml[MetaKey.Cards] : [];
        yaml[MetaKey.Cards] = [...existing, formatCardRef(ref)];
      })
    );
  }

  /**
   * Remove a card from both the first card property and the extra cards list.
   */
  async removeCardRef(cardId: string, file: TFile): Promise<CardRef[]> {
    let remainingRefs: CardRef[] = [];
    await this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
      const primary = parseCardRef(yaml[MetaKey.BoardCard]);
      const extras: unknown[] = Array.isArray(yaml[MetaKey.Cards]) ? yaml[MetaKey.Cards] : [];
      let remainingExtras = extras.filter((value) => parseCardRef(value)?.cardId !== cardId);

      if (primary?.cardId === cardId) {
        const promoted = remainingExtras.map(parseCardRef).find((ref): ref is CardRef => ref !== null);
        if (promoted) {
          yaml[MetaKey.BoardCard] = formatCardRef(promoted);
          remainingExtras = remainingExtras.filter((value) => parseCardRef(value)?.cardId !== promoted.cardId);
        } else {
          delete yaml[MetaKey.BoardCard];
        }
      }

      if (remainingExtras.length > 0) {
        yaml[MetaKey.Cards] = remainingExtras;
      } else {
        delete yaml[MetaKey.Cards];
      }
      remainingRefs = this.parseCardRefs(yaml[MetaKey.BoardCard], yaml[MetaKey.Cards]);
    });
    return remainingRefs;
  }

  /**
   * Point every stored entry for the card at its current board.
   */
  async replaceCardRef(ref: CardRef, file: TFile): Promise<{ changed: boolean; primary: CardRef | null }> {
    const formatted = formatCardRef(ref);
    let changed = false;
    let primary: CardRef | null = null;
    await this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
      if (parseCardRef(yaml[MetaKey.BoardCard])?.cardId === ref.cardId) {
        yaml[MetaKey.BoardCard] = formatted;
        changed = true;
      }
      if (Array.isArray(yaml[MetaKey.Cards])) {
        yaml[MetaKey.Cards] = yaml[MetaKey.Cards].map((value: unknown) => {
          if (parseCardRef(value)?.cardId === ref.cardId) {
            changed = true;
            return formatted;
          }
          return value;
        });
      }
      primary = parseCardRef(yaml[MetaKey.BoardCard]);
    });
    return { changed, primary };
  }

  async deleteProperty(property: string, file: TFile): Promise<void> {
    if (!file) {
      return;
    }
    return this.plugin.app.fileManager.processFrontMatter(file, (yaml) => {
      if (yaml[property] !== undefined) {
        delete yaml[property];
      }
    });
  }
}
