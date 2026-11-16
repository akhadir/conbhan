interface RegisterOptions {
  scope: string;
  updateViaCache: 'none' | 'imports' | 'all';
}

interface RegisterResult {
  scope: string;
}

interface ServiceWorkerLike {
  register: (scriptUrl: string, options: RegisterOptions) => Promise<RegisterResult>;
}

interface ServiceWorkerContainer {
  serviceWorker?: ServiceWorkerLike;
}

/**
 * Registers the Conbhan service worker for the current origin and scope.
 * `updateViaCache: 'none'` forces the browser to re-check sw.js on every load
 * instead of serving a stale copy from the HTTP cache, so deployed updates reach
 * installed PWAs promptly instead of showing a blank page on refresh.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer = typeof navigator !== 'undefined' ? navigator : {},
  baseUrl = '/',
): Promise<RegisterResult | null> {
  const serviceWorker = container.serviceWorker;
  const register = serviceWorker?.register;
  if (!register) return null;

  try {
    const registration = await serviceWorker!.register(`${baseUrl}sw.js`, {
      scope: baseUrl,
      updateViaCache: 'none',
    });
    return registration;
  } catch (error) {
    console.warn('Conbhan service worker registration failed', error);
    return null;
  }
}
