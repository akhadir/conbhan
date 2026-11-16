import { expect, test } from '@playwright/test';

test('exposes an installable manifest with reachable PNG icons', async ({ page, request }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifestUrl = new URL(manifestHref!, page.url()).toString();
  const response = await request.get(manifestUrl);
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  const baseUrl = new URL('/conbhan/', page.url()).toString();
  expect(manifest.name).toBe('Conbhan — Credit Goals');
  expect(manifest.short_name).toBe('Conbhan');
  expect(manifest.display).toBe('standalone');
  expect(new URL(manifest.start_url, manifestUrl).toString()).toBe(baseUrl);
  expect(new URL(manifest.scope, manifestUrl).toString()).toBe(baseUrl);
  expect(manifest.theme_color).toBe('#0b1220');

  for (const icon of manifest.icons as Array<{ src: string; sizes: string; type: string }>) {
    const iconUrl = new URL(icon.src, manifestUrl).toString();
    const iconResponse = await request.get(iconUrl);
    expect(iconResponse.status(), `${icon.sizes} icon at ${iconUrl}`).toBe(200);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }

  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const appleResponse = await request.get(new URL(appleIcon!, page.url()).toString());
  expect(appleResponse.status()).toBe(200);
  expect(appleResponse.headers()['content-type']).toContain('image/png');
});

test('registers a service worker and reloads offline from its cache', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /conbhan/i }).first()).toBeVisible();

  const baseUrl = new URL('/conbhan/', page.url()).toString();
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') {
      await new Promise<void>((resolve) => {
        const worker = registration.active;
        if (!worker) return resolve();
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
        });
      });
    }
    return registration.scope;
  });
  expect(scope).toBe(baseUrl);

  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 })
    .toBe(true);

  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${baseUrl}sw.js`);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain('conbhan-v1');

  // Warm the runtime cache with one online pass so the offline reload is served from the SW.
  await page.reload();
  await expect(page.getByRole('heading', { name: /conbhan/i }).first()).toBeVisible();

  // Drop the browser HTTP cache so the offline reload can only be satisfied by the SW cache.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: /conbhan/i }).first()).toBeVisible();
    await expect(page.getByText('General Credits').first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
