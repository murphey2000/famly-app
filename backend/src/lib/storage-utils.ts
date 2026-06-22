import type { App } from '../index.js';

/**
 * Mint a fresh, readable URL for a stored object.
 *
 * Specular storage has NO permanent public URL. Objects are read via
 * short-lived presigned URLs obtained from the storage proxy's download
 * endpoint:
 *
 *   GET ${STORAGE_API_BASE_URL}/download?key=<key>  ->  { url, expiresAt }
 *
 * STORAGE_API_BASE_URL (e.g. https://api.specular.dev/storage-proxy/<token>)
 * is injected into the backend at runtime and contains the access token in its
 * path, so this call must only ever be made server-side.
 */
export async function getSignedDownloadUrl(storageKey: string): Promise<string | null> {
  const base = process.env.STORAGE_API_BASE_URL;
  if (!base) return null;

  try {
    const res = await fetch(`${base}/download?key=${encodeURIComponent(storageKey)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
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
 * Resolve a stored media reference to a fresh, readable presigned URL.
 *
 * We mint a new presigned URL from the storage key on every read (they expire).
 * If no key can be derived (e.g. an already-absolute external URL), the stored
 * URL is returned as-is.
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
  if (!key) return url ?? null;
  const signed = await getSignedDownloadUrl(key);
  return signed ?? url ?? null;
}
