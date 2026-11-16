interface RegisterOptions {
  scope: string;
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
 * Returns null when unsupported (non-secure context) or when registration fails,
 * so the app keeps working as a plain website in those cases.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer = typeof navigator !== 'undefined' ? navigator : {},
  baseUrl = '/',
): Promise<RegisterResult | null> {
  const serviceWorker = container.serviceWorker;
  const register = serviceWorker?.register;
  if (!register) return null;

  try {
    const registration = await serviceWorker!.register(`${baseUrl}sw.js`, { scope: baseUrl });
    return registration;
  } catch (error) {
    console.warn('Conbhan service worker registration failed', error);
    return null;
  }
}
