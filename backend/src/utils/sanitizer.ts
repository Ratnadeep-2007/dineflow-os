/**
 * Sanitizes input text to prevent script and HTML tag injection (security.md Section 7)
 * Strips XML/HTML tags and trims whitespace.
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  
  // Remove HTML/XML tags
  let cleaned = text.replace(/<[^>]*>?/gm, '');
  
  // Strip potential javascript URLs or script tags
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/onclick|onload|onerror/gi, '');
  
  return cleaned.trim();
}
