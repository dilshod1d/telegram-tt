import { getLinkRisk, isApkFile } from './localSafety';

describe('local link checks', () => {
  test.each([
    'https://example.com/path?email=user@example.org',
    'http://192.0.2.1/',
    'https://t.me/example',
    'https://bit.ly/example',
    'https://пример.com',
    'https://日本語.jp',
    'https://école.fr',
    'mailto:user@example.com',
    'tg://resolve?domain=example',
    'not a URL',
  ])('does not call an ordinary URL suspicious: %s', (url) => {
    expect(getLinkRisk(url)).toBeUndefined();
  });

  test.each([
    ['https://trusted.example@destination.example', 'login'],
    ['https://user:password@example.com', 'login'],
    ['https://example.com/\u202Etxt', 'direction'],
    ['https://example.com/%E2%80%AEtxt', 'direction'],
    ['https://pаypal.example', 'mixed'],
    ['https://xn--pypal-4ve.example', 'mixed'],
  ])('explains a specific signal: %s', (url, risk) => {
    expect(getLinkRisk(url)).toBe(risk);
  });
});

test('APK metadata is a file-type warning, including conflicting MIME/extension', () => {
  expect(isApkFile('APP.APK', 'text/plain')).toBe(true);
  expect(isApkFile('invoice.pdf', 'application/vnd.android.package-archive; x=1')).toBe(true);
  expect(isApkFile('notes.apk.txt', 'text/plain')).toBe(false);
  expect(isApkFile('archive.zip', 'application/zip')).toBe(false);
});
