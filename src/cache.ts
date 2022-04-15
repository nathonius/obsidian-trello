import { CacheTimeout, CacheType } from './constants';
import {
  TrelloAction,
  TrelloCacheItem,
  TrelloCard,
  TrelloChecklist,
  TrelloItemCache,
  TrelloLabel,
  TrelloList
} from './interfaces';

export type CacheTypes = TrelloCard | TrelloAction[] | TrelloList | TrelloLabel[] | TrelloChecklist;

export class TrelloPluginCache {
  readonly _cache: Record<CacheType, TrelloItemCache<CacheTypes>> = {
    [CacheType.Card]: new Map<string, TrelloCacheItem<TrelloCard>>(),
    [CacheType.CardActions]: new Map<string, TrelloCacheItem<TrelloAction[]>>(),
    [CacheType.List]: new Map<string, TrelloCacheItem<TrelloList>>(),
    [CacheType.Label]: new Map<string, TrelloCacheItem<TrelloLabel[]>>(),
    [CacheType.Checklist]: new Map<string, TrelloCacheItem<TrelloChecklist>>()
  };

  /**
   * Get an item if cached and not expired
   */
  getItem<T extends CacheTypes>(itemId: string, itemType: CacheType): TrelloCacheItem<T> | null {
    const cache = this._cache[itemType] as TrelloItemCache<T>;
    const timeout = CacheTimeout[itemType];
    const cachedItem = cache.get(itemId);
    return cachedItem && new Date().getTime() - cachedItem.timestamp.getTime() > timeout ? cachedItem : null;
  }

  /**
   * Update an item in the cache
   */
  setItem<T extends CacheTypes>(itemId: string, item: T, itemType: CacheType): void {
    const cache = this._cache[itemType] as TrelloItemCache<T>;
    cache.set(itemId, { item, timestamp: new Date() });
  }

  /**
   * Clear the cache of a given type or all caches
   */
  clearCache(cacheType?: CacheType): void {
    if (cacheType) {
      this._cache[cacheType].clear();
    } else {
      this._cache[CacheType.Card].clear();
      this._cache[CacheType.CardActions].clear();
      this._cache[CacheType.List].clear();
      this._cache[CacheType.Label].clear();
      this._cache[CacheType.Checklist].clear();
    }
  }
}
