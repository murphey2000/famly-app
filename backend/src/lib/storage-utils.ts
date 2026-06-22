import type { App } from '../index.js';

/**
 * Build a permanent public URL from a storage key.
 *
 * The Specular storage proxy serves uploaded objects at
 * `${STORAGE_API_BASE_URL}/public/<key>`. STORAGE_API_BASE_URL is injected into
 * the backend at runtime (e.g. https://api.specular.dev/storage-proxy/<token>).
 */
export function generatePublicUrl(storageKey: string): string {
  const base = process.env.STORAGE_API_BASE_URL || '';
  return `${base}/public/${storageKey}`;
}

/**
 * Resolve the storage key for a media row.
 *
 * Prefers the explicit `storage_key` column, then falls back to parsing the key
 * out of a previously-stored `/public/<key>` URL so legacy rows keep working.
 */
export function extractStorageKey(
  url: string | null | undefined,
  storageKey: string | null | undefined
): string | null {
  if (storageKey) return storageKey;
  if (!url) return null;

  const publicIdx = url.indexOf('/public/');
  if (publicIdx !== -1) {
    return decodeURIComponent(url.slice(publicIdx + '/public/'.length).split('?')[0]);
  }

  return null;
}

/**
 * Resolve a stored media reference to a readable public URL.
 *
 * When we know the storage key we regenerate the public URL from it (this
 * survives changes to STORAGE_API_BASE_URL); otherwise the stored URL is
 * already a usable public URL and is returned as-is.
 *
 * `storage` is currently unused but kept in the signature so callers don't need
 * to change if storage-backed URL generation is reintroduced.
 */
export async function resolveMediaUrl(
  _storage: App['storage'],
  url: string | null | undefined,
  storageKey: string | null | undefined
): Promise<string | null> {
  const key = extractStorageKey(url, storageKey);
  if (key) return generatePublicUrl(key);
  return url ?? null;
}
