/** Safe API URL handling. Empty or malformed configuration never reaches fetch(). */
export function resolveApiUrl(raw?: string | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  let candidate = value;
  if (/^[\w.-]+:\d+(\/|$)/.test(candidate)) candidate = `http://${candidate}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export const SUKI_CHAT_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
