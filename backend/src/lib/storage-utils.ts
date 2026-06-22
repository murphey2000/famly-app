/**
 * Generate a public URL from a storage key.
 * Public URLs are permanent and never expire.
 */
export function generatePublicUrl(storageKey: string): string {
  const storageBaseUrl = process.env.STORAGE_API_BASE_URL || '';
  return `${storageBaseUrl}/public/${storageKey}`;
}

/**
 * Extract storage key from a signed URL (legacy support).
 * Detects signed URL indicators and extracts the key path.
 */
export function extractKeyFromSignedUrl(url: string): string | null {
  // Check for signed URL indicators
  if (!url.includes('X-Amz-Expires') && !url.includes('X-Goog-Expires') && !url.includes('x-goog-signature')) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    // Remove query parameters to get the path
    const pathname = urlObj.pathname;
    // Remove leading /public/ if present
    if (pathname.startsWith('/public/')) {
      return pathname.substring(8); // '/public/'.length = 8
    }
    return pathname.substring(1); // Remove leading /
  } catch {
    return null;
  }
}

/**
 * Refresh media URL - returns a fresh public URL.
 * Uses storage_key if available, otherwise tries to extract from stored URL.
 */
export function refreshMediaUrl(url: string | null | undefined, storageKey: string | null | undefined): string | null {
  if (!url) return null;

  // If we have a storage key, always use it to generate a fresh public URL
  if (storageKey) {
    return generatePublicUrl(storageKey);
  }

  // Legacy: try to extract key from stored signed URL
  const extractedKey = extractKeyFromSignedUrl(url);
  if (extractedKey) {
    return generatePublicUrl(extractedKey);
  }

  // If it's already a public URL (no signed indicators), return as-is
  return url;
}
