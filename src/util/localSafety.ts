import convertPunycode from '../lib/punycode';

export type LinkRisk = 'login' | 'direction' | 'mixed';

export function getLinkRisk(url: string): LinkRisk | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    return undefined;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
  if (parsed.username || parsed.password) return 'login';

  let decoded = url;
  try {
    decoded = decodeURI(url);
  } catch (e) {
    // Keep checking the original address if its escaping is malformed.
  }
  if (/[\u202A-\u202E\u2066-\u2069]/u.test(decoded)) return 'direction';

  const host = convertPunycode(parsed.hostname);
  const hasMixedLabel = host.split('.').some((label) => {
    const scripts = [/\p{Script=Latin}/u, /\p{Script=Cyrillic}/u, /\p{Script=Greek}/u];
    return scripts.filter((script) => script.test(label)).length > 1;
  });
  return hasMixedLabel ? 'mixed' : undefined;
}

export function isApkFile(fileName?: string, mimeType?: string): boolean {
  return Boolean(fileName?.trim().toLowerCase().endsWith('.apk'))
    || mimeType?.split(';')[0].trim().toLowerCase() === 'application/vnd.android.package-archive';
}
