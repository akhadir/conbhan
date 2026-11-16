import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../../src/lib/pwa';

const root = join(__dirname, '..', '..');

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8')) as Record<string, unknown>;
}

async function exists(relativePath: string) {
  try {
    await stat(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function pngSize(bytes: Buffer) {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('web app manifest', () => {
  it('declares an installable standalone app with 192 and 512 icons', async () => {
    const manifest = await readJson('public/manifest.webmanifest');

    expect(manifest.name).toBe('Conbhan — Credit Goals');
    expect(manifest.short_name).toBe('Conbhan');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.theme_color).toBe('#0b1220');
    expect(manifest.background_color).toBe('#070b14');

    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png')).toBe(true);
    expect(icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);

    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith('/')).toBe(false);
      expect(await exists(join('public', icon.src))).toBe(true);
      const bytes = await readFile(join(root, 'public', icon.src));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(pngSize(bytes)).toEqual({ width, height });
    }
  });

  it('links the manifest, theme colour and a 180px Apple touch icon from index.html', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const { document } = new JSDOM(html).window;

    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('./manifest.webmanifest');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b1220');
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe(
      './icons/apple-touch-icon.png',
    );
    expect(document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content')).toBe('yes');

    const appleIcon = await readFile(join(root, 'public/icons/apple-touch-icon.png'));
    expect(appleIcon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(pngSize(appleIcon)).toEqual({ width: 180, height: 180 });
  });
});

describe('registration', () => {
  it('registers the worker under the deployed base path', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/conbhan/' });
    const container = { serviceWorker: { register } } as unknown as Pick<Navigator, 'serviceWorker'>;

    const registration = await registerServiceWorker(container, '/conbhan/');

    expect(register).toHaveBeenCalledWith('/conbhan/sw.js', { scope: '/conbhan/' });
    expect(registration).toEqual({ scope: '/conbhan/' });
  });

  it('defaults to the build base path', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    const container = { serviceWorker: { register } } as unknown as Pick<Navigator, 'serviceWorker'>;

    await registerServiceWorker(container);

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('is a no-op in browsers without service worker support', async () => {
    const registration = await registerServiceWorker({} as unknown as Pick<Navigator, 'serviceWorker'>, '/');

    expect(registration).toBeNull();
  });

  it('does not break the app when registration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error('insecure context'));
    const container = { serviceWorker: { register } } as unknown as Pick<Navigator, 'serviceWorker'>;

    await expect(registerServiceWorker(container, '/')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('is registered at boot with the build base path', async () => {
    const main = await readFile(join(root, 'src/main.tsx'), 'utf8');
    expect(main).toMatch(/from ['"]\.\/lib\/pwa['"]/);
    expect(main).toMatch(/registerServiceWorker\(navigator,\s*import\.meta\.env\.BASE_URL\)/);
  });
});
