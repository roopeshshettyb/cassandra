import { CacheService } from '../../src/common/cache/cache.service';

const MINUTE = 60 * 1000;

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new CacheService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and returns a value', () => {
    cache.set('k', { a: 1 });
    expect(cache.get<{ a: number }>('k')).toEqual({ a: 1 });
    expect(cache.has('k')).toBe(true);
  });

  it('returns null for a key that was never set', () => {
    expect(cache.get('missing')).toBeNull();
    expect(cache.has('missing')).toBe(false);
  });

  it('overwrites an existing key', () => {
    cache.set('k', 'first');
    cache.set('k', 'second');
    expect(cache.get('k')).toBe('second');
    expect(cache.size()).toBe(1);
  });

  it('keeps a value alive until the custom expiry elapses', () => {
    cache.set('k', 'v', 5);
    jest.advanceTimersByTime(5 * MINUTE);
    expect(cache.get('k')).toBe('v'); // expiry is exclusive: now > expiresAt

    jest.advanceTimersByTime(1);
    expect(cache.get('k')).toBeNull();
  });

  it('applies the 180 minute default expiry', () => {
    cache.set('k', 'v');
    jest.advanceTimersByTime(179 * MINUTE);
    expect(cache.get('k')).toBe('v');

    jest.advanceTimersByTime(2 * MINUTE);
    expect(cache.get('k')).toBeNull();
  });

  it('evicts an expired entry when read through get/has', () => {
    cache.set('k', 'v', 1);
    jest.advanceTimersByTime(2 * MINUTE);

    expect(cache.has('k')).toBe(false);
    expect(cache.get('k')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('deletes a key and reports whether it existed', () => {
    cache.set('k', 'v');
    expect(cache.delete('k')).toBe(true);
    expect(cache.delete('k')).toBe(false);
    expect(cache.get('k')).toBeNull();
  });

  it('clears every entry', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.getAllKeys()).toEqual([]);
  });

  it('excludes expired entries from size and getAllKeys', () => {
    cache.set('short', 'v', 1);
    cache.set('long', 'v', 60);
    jest.advanceTimersByTime(2 * MINUTE);

    expect(cache.size()).toBe(1);
    expect(cache.getAllKeys()).toEqual(['long']);
  });

  it('stores falsy values without treating them as misses', () => {
    cache.set('zero', 0);
    cache.set('empty', '');
    cache.set('null', null);

    expect(cache.get('zero')).toBe(0);
    expect(cache.get('empty')).toBe('');
    expect(cache.has('null')).toBe(true);
  });

  it('keeps entries independent across instances', () => {
    const other = new CacheService();
    cache.set('k', 'v');
    expect(other.get('k')).toBeNull();
  });
});
