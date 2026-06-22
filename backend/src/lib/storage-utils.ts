import type { App } from '../index.js';

/**
 * Resolve the storage key for a media row.
 *
 * Prefers the explicit `storage_key` column. Falls back to parsing a key out of
 * a previously-stored URL so legacy rows keep working:
 *  - rows that stored a host-less `/public/<key>` path
 *  - rows that stored an old signed URL (key is the path, minus the query)
 */
export function extractStorageKey(
  url: string | null | undefined,
  storageKey: string | null | undefined
): string | null {
  if (storageKey) return storageKey;
  if (!url) return null;

  // URL that embeds the key after "/public/"
  const publicIdx = url.indexOf('/public/');
  if (publicIdx !== -1) {
    return decodeURIComponent(url.slice(publicIdx + '/public/'.length).split('?')[0]);
  }

  // Legacy signed URLs (S3/GCS) — the key is the path, sans query string
  if (url.includes('X-Amz-') || url.includes('X-Goog-') || url.includes('x-goog-signature')) {
    try {
      const { pathname } = new URL(url);
      const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      return decodeURIComponent(path.startsWith('public/') ? path.slice('public/'.length) : path);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolve a stored media reference to a fresh, readable URL.
 *
 * Object storage exposes files via short-lived signed URLs, so we mint one per
 * request from the storage key. If no key can be derived (e.g. an already
 * absolute URL), the stored URL is returned unchanged.
 */
export async function resolveMediaUrl(
  storage: App['storage'],
  url: string | null | undefined,
  storageKey: string | null | undefined
): Promise<string | null> {
  const key = extractStorageKey(url, storageKey);
  if (!key) return url ?? null;
  try {
    return await storage.getSignedUrl(key);
  } catch {
    return url ?? null;
  }
}
