import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const activeList = (page: Page) => page.locator('.ChatFolders > .Transition > .Transition_slide-active');
const peopleTab = (page: Page) => page.locator('.Tab').filter({ hasText: /^People/ });
const allTab = (page: Page) => page.locator('.Tab').first();

async function waitForListAnimations(page: Page) {
  await expect.poll(() => page.locator('.ChatFolders').evaluate((element) => (
    element.getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== 'running')
  ))).toBe(true);
}

async function openScenario(page: Page, scenario = 'people') {
  await page.goto(`/#?mockScenario=${scenario}`);
  await expect(peopleTab(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const global = (window as any).getGlobal?.();
    return Boolean(global?.chats.isFullyLoaded.active && global?.chats.isFullyLoaded.archived
      && global?.peerColors?.general && global?.isSynced && !global?.isSyncing && !global?.isFetchingDifference);
  })).toBe(true);
}

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).origin === 'http://127.0.0.1:1235'
      ? route.continue() : route.abort();
  });
  page.on('websocket', (socket) => {
    expect(new URL(socket.url()).hostname, 'Mocked mode must not open Telegram transport').toBe('127.0.0.1');
  });
});

test('People is second without folders and contains only unarchived human conversations', async ({ page }, info) => {
  await openScenario(page);
  await expect(page.locator('.Tab')).toHaveCount(2);
  await expect(allTab(page)).toHaveClass(/Tab--active/);
  await peopleTab(page).click();
  await expect(peopleTab(page)).toHaveClass(/Tab--active/);
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
  await expect(peopleTab(page).locator('.badge')).toHaveText('2');
  await expect(activeList(page).locator('.chat-item-archive')).toHaveCount(0);
  await waitForListAnimations(page);
  const screenshot = info.outputPath('people.png');
  await page.screenshot({ path: screenshot });
  await info.attach('people', { path: screenshot, contentType: 'image/png' });
  await allTab(page).click();
  await expect(activeList(page).getByText('Test Group', { exact: true })).toBeVisible();
});

test('People preserves existing folder order and keyboard selection', async ({ page }) => {
  await openScenario(page, 'people-folders');
  await expect(page.locator('.Tab .Tab_inner')).toHaveText([/All/, /People/, /Work/, /Groups/]);
  await page.keyboard.press('Control+Shift+Digit2');
  await expect(peopleTab(page)).toHaveClass(/Tab--active/);
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
  await page.keyboard.press('Control+Shift+Digit3');
  await expect(page.locator('.Tab').nth(2)).toHaveClass(/Tab--active/);
});

test('People reaches conversations after the first page of groups', async ({ page }) => {
  await page.goto('/#?mockScenario=people-paged');
  await expect(peopleTab(page)).toBeVisible();
  await peopleTab(page).click();
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
});

test('an empty People category settles without folder editing controls', async ({ page }, info) => {
  await openScenario(page, 'people-empty');
  await peopleTab(page).click();
  await expect(activeList(page).locator('.Chat')).toHaveCount(0);
  await expect(activeList(page)).not.toContainText('Loading');
  await expect(activeList(page).getByText(/edit folder/i)).toHaveCount(0);
  await expect(activeList(page).getByText('No conversations yet', { exact: true })).toBeVisible();
  await waitForListAnimations(page);
  await page.screenshot({ path: info.outputPath('people-empty.png') });
});

test('pinning in People changes main-list pins and preserves unrelated pinned groups', async ({ page }) => {
  await openScenario(page);
  await peopleTab(page).click();
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
  await activeList(page).locator('.Chat').filter({ hasText: 'Bob Stranger' })
    .locator('.ListItem-button')
    .click({ button: 'right' });
  await page.locator('.MenuItem').filter({ has: page.locator('.icon-pin') }).click();
  await expect.poll(() => page.evaluate(() => (window as any).getGlobal().chats.orderedPinnedIds.active))
    .toEqual(['12', '-15', '11']);
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Bob Stranger', 'Alice Contact']);
  await allTab(page).click();
  await expect(activeList(page).locator('.Chat .title').first()).toHaveText('Bob Stranger');
  await expect(activeList(page).getByText('Test Group', { exact: true })).toBeVisible();
});

test('reading a conversation changes the badge and keeps the read conversation in People', async ({ page }) => {
  await openScenario(page);
  await peopleTab(page).click();
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
  const alice = activeList(page).locator('.Chat').filter({ hasText: 'Alice Contact' });
  await alice.locator('.ListItem-button').click({ button: 'right' });
  await page.getByText('Mark as Read', { exact: true }).click();
  await expect(peopleTab(page).locator('.badge')).toHaveText('1');
  await expect(alice).toBeVisible();
});

test('archiving from People updates both People and the main list', async ({ page }) => {
  await openScenario(page);
  await peopleTab(page).click();
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact', 'Bob Stranger']);
  await activeList(page).locator('.Chat').filter({ hasText: 'Bob Stranger' })
    .locator('.ListItem-button')
    .click({ button: 'right' });
  await page.getByText('Archive', { exact: true }).click();
  await expect(activeList(page).locator('.Chat .title')).toHaveText(['Alice Contact']);
  await expect(peopleTab(page).locator('.badge')).toHaveText('1');
  await allTab(page).click();
  await expect(activeList(page).locator('.Chat').filter({ hasText: 'Bob Stranger' })).toHaveCount(0);
});
