import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function setLink(page: Page, url: string, text = url) {
  await page.evaluate(({ url: link, text: label }) => {
    const global = (window as any).getGlobal();
    const chat = global.messages.byChatId['11'];
    const message = chat.byId[11];
    (window as any).setGlobal({
      ...global,
      messages: {
        ...global.messages,
        byChatId: {
          ...global.messages.byChatId,
          11: {
            ...chat,
            byId: {
              ...chat.byId,
              11: {
                ...message,
                content: {
                  text: {
                    text: label,
                    entities: [{
                      type: label === link ? 'MessageEntityUrl' : 'MessageEntityTextUrl',
                      offset: 0,
                      length: label.length,
                      ...(label === link ? {} : { url: link }),
                    }],
                  },
                },
              },
            },
          },
        },
      },
    });
  }, { url, text });
}

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).origin === 'http://127.0.0.1:1235'
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    (window as any).openedUrls = [];
    window.open = ((url: string) => {
      (window as any).openedUrls.push(String(url));
      return null; // eslint-disable-line no-null/no-null
    }) as typeof window.open;
  });
  await page.goto('/#?mockScenario=local-safety');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).getGlobal?.().isSynced))).toBe(true);
  await page.locator('.Chat').filter({ hasText: 'Alice Contact' }).locator('.ListItem-button').click();
  await expect(page.locator('.File')).toBeVisible();
});

test('ordinary URLs open without a risk warning', async ({ page }) => {
  await setLink(page, 'https://example.com/path?email=user@example.org');
  await page.getByRole('link', { name: 'https://example.com/path?email=user@example.org', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).openedUrls)).toEqual([
    'https://example.com/path?email=user@example.org',
  ]);
  await expect(page.getByText('Check this link', { exact: true })).toHaveCount(0);
});

test('a masked ordinary URL keeps its neutral confirmation', async ({ page }) => {
  await setLink(page, 'https://example.com/', 'Read the documentation');
  await page.getByRole('link', { name: 'Read the documentation', exact: true }).click();
  await expect(page.locator('.Modal.open')).toContainText('example.com');
  await expect(page.getByText('Check this link', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).openedUrls)).toEqual([]);
});

test('a specific suspicious signal explains the destination and allows cancel or open', async ({ page }, info) => {
  const url = 'https://trusted.example@destination.example/';
  await setLink(page, url);
  await page.getByRole('link', { name: url, exact: true }).click();
  await expect(page.getByText('Check this link', { exact: true })).toBeVisible();
  await expect(page.getByText('Destination: destination.example', { exact: true })).toBeVisible();
  await expect(page.locator('.Modal.open')).toContainText('This does not mean the link is malicious.');
  await page.screenshot({ path: info.outputPath('link-warning.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).openedUrls)).toEqual([]);
  await page.getByRole('link', { name: url, exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).openedUrls)).toEqual([url]);
});

test('APK downloads require confirmation and cancel leaves no active download', async ({ page }, info) => {
  await page.locator('.File .file-icon-container').click();
  await expect(page.getByText('Android app file', { exact: true })).toBeVisible();
  await expect(page.locator('.Modal.open')).toContainText('This warning does not mean the file is malware.');
  await page.screenshot({ path: info.outputPath('apk-warning.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => {
    const global = (window as any).getGlobal();
    return Object.values(global.byTabId).some((tab: any) => Object.keys(tab.activeDownloads).length);
  })).toBe(false);
  await page.locator('.File .file-icon-container').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await downloaded;
  await expect(page.getByText('Android app file', { exact: true })).not.toBeVisible();
});
