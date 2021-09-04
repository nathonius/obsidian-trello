import { App, SuggestModal } from 'obsidian';
import { Subject } from 'rxjs';
import { PluginError } from '../interfaces';

/**
 * A suggest modal that works well with RxJS
 * Will call next on selected when an option is chosen
 * Will call error on selected when closing without choosing an option
 */
export abstract class AbortSuggestModal<T> extends SuggestModal<T> {
  selected = new Subject<T>();
  options: T[] = [];

  private selectionMade = false;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.selectionMade = false;
    super.onOpen();
  }

  onClose(): void {
    if (!this.selectionMade) {
      this.selected.error(PluginError.Abort);
      this.selected.complete();
      this.selected = new Subject<T>();
    }
    super.onClose();
  }

  selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
    this.selectionMade = true;
    super.selectSuggestion(value, evt);
  }

  onChooseSuggestion(item: T): void {
    this.selected.next(item);
    this.selected.complete();
    this.selected = new Subject<T>();
  }
}
