import { EMPTY, Observable, of, take } from 'rxjs';
import { ajax as RxJSAjax } from 'rxjs/ajax';

import { TrelloAPI, CacheState } from './api';
import { TrelloAction, TrelloCard, TrelloChecklist, TrelloItemCache, TrelloLabel, TrelloList } from './interfaces';

// Jasmine groups tests in 'describe' blocks.
// You can nest describes.
describe('TrelloAPI', () => {
  let cardCache: TrelloItemCache<TrelloCard>;
  let cardActionsCache: TrelloItemCache<TrelloAction[]>;
  let listCache: TrelloItemCache<TrelloList>;
  let labelCache: TrelloItemCache<TrelloLabel[]>;
  let checklistCache: TrelloItemCache<TrelloChecklist>;
  let token: Observable<string>;
  let state: CacheState;
  let logFn: jasmine.Spy;
  let api: TrelloAPI;
  let ajax: jasmine.Spy;

  // Setup, this is called before every test.
  beforeEach(() => {
    token = of('mock-token');
    logFn = jasmine.createSpy('log');
    cardCache = {};
    cardActionsCache = {};
    listCache = {};
    labelCache = {};
    checklistCache = {};
    state = { cardCache, cardActionsCache, listCache, labelCache, checklistCache };
    ajax = jasmine.createSpy('ajax');
    api = new TrelloAPI(token, state, logFn, ajax as unknown as typeof RxJSAjax);
  });

  // A single test
  it('should be created', () => {
    expect(api).toBeTruthy();
  });

  describe('getCardFromBoard', () => {
    // An asynchronous test. Call `done` when complete.
    it('should check cached value', (done) => {
      // Set item in cache
      const cacheDate = new Date();
      const mockId = 'mockId';
      const mockCard = {} as TrelloCard;
      cardCache[mockId] = { item: mockCard, timestamp: cacheDate };

      // Call api method
      api
        .getCardFromBoard('boardId', mockId)
        .pipe(take(1))
        .subscribe((result) => {
          expect(result).toBe(mockCard);
          done();
        });
    });

    it('should call API if no value is cached and cache response', (done) => {
      const mockResponse = { response: { id: 'mockId' } };
      ajax.and.returnValue(of(mockResponse));
      api
        .getCardFromBoard('boardId', 'mockId')
        .pipe(take(1))
        .subscribe((result) => {
          expect(result).toBe(mockResponse.response as TrelloCard);
          expect(ajax).toHaveBeenCalled();
          expect(cardCache['mockId'].item).toBe(mockResponse.response as TrelloCard);
          done();
        });
    });
  });
});
