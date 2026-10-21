import { BehaviorSubject, Observable, of } from 'rxjs';
import { CardRef, PluginUISettings } from '../interfaces';
import { distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';

import { CardModel } from './card-model';
import { GLOBAL_UI } from '../constants';
import { TrelloPlugin } from '../plugin';
import { formatCardRef } from '../yaml-handler';

/**
 * Provides state for the view: one model per linked card plus the UI config.
 */
export class TrelloViewManager {
  readonly connectedId = new BehaviorSubject<string | null>(null);
  readonly cards = new BehaviorSubject<CardModel[]>([]);
  readonly currentUIConfig = new BehaviorSubject<PluginUISettings | null>(null);

  constructor(
    private readonly plugin: TrelloPlugin,
    private readonly destroy: Observable<void>,
    private readonly update: Observable<void>
  ) {
    // Keep one model per linked card, reusing models for cards that are still linked
    this.plugin.state.cardRefs.pipe(takeUntil(this.destroy)).subscribe((refs) => this.syncModels(refs));

    // Update card UI when the current plugin ID changes
    this.plugin.state.connectedCardId
      .pipe(
        takeUntil(this.destroy),
        switchMap((connected) => {
          if (!connected) {
            this.connectedId.next(null);
            this.currentUIConfig.next(null);
            return of(null);
          }
          this.connectedId.next(connected);
          return this.plugin.state.settings.pipe(
            map((s) => s.customUi),
            distinctUntilChanged(),
            map((customUiSettings) => ({ connected, customUiSettings }))
          );
        })
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        const { connected, customUiSettings } = result;
        const uiConfig = customUiSettings[connected] ? customUiSettings[connected] : customUiSettings[GLOBAL_UI];
        this.currentUIConfig.next(uiConfig);
        this.plugin.log('TrelloViewManager', `Connected card with ${connected}`);
      });

    // Refresh data
    this.update.pipe(takeUntil(this.destroy)).subscribe(() => {
      this.cards.value.forEach((model) => model.refresh());
    });

    this.destroy.subscribe(() => {
      this.cards.value.forEach((model) => model.dispose());
    });
  }

  private syncModels(refs: CardRef[]): void {
    const existing = new Map(this.cards.value.map((model) => [model.key, model]));
    const next = refs.map(
      (ref) => existing.get(formatCardRef(ref)) ?? new CardModel(this.plugin, ref, this.currentUIConfig)
    );
    existing.forEach((model) => {
      if (!next.includes(model)) {
        model.dispose();
      }
    });
    this.cards.next(next);
  }
}
