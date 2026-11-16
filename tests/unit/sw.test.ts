import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const root = join(__dirname, '..', '..');
const scope = 'https://akhadir.github.io/conbhan/';
const CACHE_NAME = 'conbhan-v1';

class FakeCache {
  store = new Map<string, Response>();

  key(input: RequestInfo | URL) {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return new URL(raw, scope).toString();
  }

  async addAll(urls: string[]) {
    for (const url of urls) {
      this.store.set(this.key(url), new Response(`precached:${new URL(url, scope).pathname}`));
    }
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.store.set(this.key(request), response);
  }

  async match(request: RequestInfo | URL) {
    return this.store.get(this.key(request));
  }
}

/** Executes the real public/sw.js against fake worker globals and returns dispatch helpers. */
async function loadWorker() {
  const source = await readFile(join(root, 'public/sw.js'), 'utf8');
  const listeners = new Map<string, (event: unknown) => void>();
  const cachesMap = new Map<string, FakeCache>();
  const skipWaiting = vi.fn();
  const claim = vi.fn();

  const caches = {
    async open(name: string) {
      if (!cachesMap.has(name)) cachesMap.set(name, new FakeCache());
      return cachesMap.get(name)!;
    },
    async keys() {
      return [...cachesMap.keys()];
    },
    async delete(name: string) {
      return cachesMap.delete(name);
    },
    async match(request: RequestInfo | URL) {
      for (const cache of cachesMap.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockImplementation(
    () => Promise.resolve(new Response(JSON.stringify({ 'index.html': { file: 'assets/index-fake.js' } }), { headers: { 'content-type': 'application/json' } })),
  );

  const self = {
    registration: { scope },
    clients: { claim },
    skipWaiting,
    addEventListener(type: string, listener: (event: unknown) => void) {
      listeners.set(type, listener);
    },
  };

  vm.runInNewContext(source, { self, caches, fetch: fetchMock, Response, URL, console });

  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const listener = listeners.get(type);
    if (!listener) throw new Error(`No ${type} listener registered`);
    const pending: Promise<unknown>[] = [];
    listener({
      ...event,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      respondWith: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
    return { cachesMap, skipWaiting, claim, fetchMock };
  };

  return { dispatch, cachesMap, skipWaiting, claim, fetchMock, listeners };
}

describe('service worker behaviour', () => {
  it('precaches the app shell on install and activates immediately', async () => {
    const worker = await loadWorker();
    await worker.dispatch('install', {});

    expect(worker.skipWaiting).toHaveBeenCalled();

    const shell = worker.cachesMap.get(CACHE_NAME);
    expect(shell).toBeDefined();
    const urls = [...shell!.store.keys()];
    expect(urls).toContain(`${scope}index.html`);
    expect(urls).toContain(`${scope}manifest.webmanifest`);
    expect(urls.some((url) => url.endsWith('/icons/icon-192.png'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/icons/icon-512.png'))).toBe(true);
  });

  it('deletes stale caches and claims clients on activate', async () => {
    const worker = await loadWorker();
    worker.cachesMap.set('conbhan-v0', new FakeCache());
    worker.cachesMap.set(CACHE_NAME, new FakeCache());

    await worker.dispatch('activate', {});

    expect(worker.cachesMap.has('conbhan-v0')).toBe(false);
    expect(worker.cachesMap.has(CACHE_NAME)).toBe(true);
    expect(worker.claim).toHaveBeenCalled();
  });

  it('serves the cached shell for offline navigations', async () => {
    const worker = await loadWorker();
    await worker.dispatch('install', {});
    worker.fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const navigation = { method: 'GET', mode: 'navigate', url: `${scope}some/deep/link` };
    const pending: Promise<unknown>[] = [];
    worker.listeners.get('fetch')!({
      request: navigation,
      respondWith: (promise: Promise<unknown>) => pending.push(promise),
    });

    const response = (await pending[0]) as Response;
    expect(await response.text()).toBe('precached:/conbhan/index.html');
    expect(worker.fetchMock).toHaveBeenCalled();
  });

  it('serves cached assets and only writes GET responses to the cache', async () => {
    const worker = await loadWorker();
    await worker.dispatch('install', {});
    const cache = worker.cachesMap.get(CACHE_NAME)!;
    worker.fetchMock.mockClear();

    await cache.put(`${scope}assets/app.js`, new Response('cached-asset'));
    const cached = await worker.dispatch('fetch', {
      request: { method: 'GET', mode: 'cors', url: `${scope}assets/app.js` },
    });
    expect(cached.fetchMock).not.toHaveBeenCalled();

    worker.fetchMock.mockResolvedValue(new Response('fresh-asset'));
    await worker.dispatch('fetch', {
      request: { method: 'GET', mode: 'cors', url: `${scope}assets/miss.js` },
    });
    expect(worker.fetchMock).toHaveBeenCalled();
    expect(cache.store.get(`${scope}assets/miss.js`)).toBeDefined();

    worker.fetchMock.mockClear();
    await worker.dispatch('fetch', {
      request: { method: 'POST', mode: 'cors', url: `${scope}api/save` },
    });
    expect(worker.fetchMock).not.toHaveBeenCalled();
    expect(cache.store.has(`${scope}api/save`)).toBe(false);
  });
});
