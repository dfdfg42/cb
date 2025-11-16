import { test, expect, Page } from '@playwright/test';

const attackerCards = ['베기', '철벽'];
const defenderCards = ['되받아치기', '방패'];

test.describe('멀티플레이어 전투 흐름', () => {
  test('되받아치기 이후 공격자가 다시 방어한다', async ({ browser }) => {
    const attackerContext = await browser.newContext();
    const defenderContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();
    const defenderPage = await defenderContext.newPage();
    attachLogging(attackerPage, 'A');
    attachLogging(defenderPage, 'B');

    const attackerName = generatePlayerName('A');
    const defenderName = generatePlayerName('B');

    try {
      console.log('[INFO] Initializing players');
      await initializePlayer(attackerPage, attackerName);
      await initializePlayer(defenderPage, defenderName);

      console.log('[INFO] Joining normal room');
      await joinNormalGame(attackerPage);
      await joinNormalGame(defenderPage);

      await waitForScreen(attackerPage, 'waiting-screen');
      await waitForScreen(defenderPage, 'waiting-screen');

      console.log('[INFO] Defender readying up');
      await defenderPage.click('#ready-btn');
      await attackerPage.waitForFunction(() => {
        const btn = document.getElementById('ready-btn');
        return Boolean(btn && btn.textContent?.includes('게임 시작'));
      });
      console.log('[INFO] Host starting game');
      await attackerPage.click('#ready-btn');

      await Promise.all([
        waitForScreen(attackerPage, 'game-screen'),
        waitForScreen(defenderPage, 'game-screen')
      ]);

      await waitForHand(attackerPage);
      await waitForHand(defenderPage);

      console.log('[INFO] Forcing deterministic hands');
      await forceHand(attackerPage, attackerName, attackerCards);
      await forceHand(defenderPage, defenderName, defenderCards);

      console.log('[INFO] Performing attack');
      await performAttack(attackerPage, defenderName, '베기');

      console.log('[INFO] Waiting for defender reflect response');
      await waitForDefenseRequest(defenderPage);
      await selectDefenseCard(defenderPage, '되받아치기');
      await waitForDefenseClear(defenderPage);

      await expectLogContains(defenderPage, '되받아치기');

      console.log('[INFO] Waiting for reflected defense request on attacker');
      await waitForDefenseRequest(attackerPage);
      await selectDefenseCard(attackerPage, '철벽');
      await waitForDefenseClear(attackerPage);

      await expectLogContains(attackerPage, '데미지');
    } finally {
      await attackerContext.close();
      await defenderContext.close();
    }
  });
});

async function initializePlayer(page: Page, name: string) {
  await page.goto('/');
  await page.fill('#username-input', name);
  await page.click('#enter-btn');
  await waitForScreen(page, 'lobby-screen');
}

async function joinNormalGame(page: Page) {
  await page.click('#normal-game-btn');
}

async function waitForScreen(page: Page, screenId: string) {
  await page.waitForFunction((id) => {
    const el = document.getElementById(id);
    return Boolean(el?.classList.contains('active'));
  }, screenId);
}

async function waitForHand(page: Page) {
  await page.waitForSelector('#hand-cards .card', { state: 'visible' });
}

async function forceHand(page: Page, playerName: string, cardNames: string[]) {
  await page.waitForFunction(() => Boolean((window as any).game?.gameManager));
  await page.evaluate(
    ({ playerName, cardNames }) => {
      const game = (window as any).game;
      if (!game || typeof game.debugSetHand !== 'function') {
        throw new Error('debugSetHand helper is unavailable');
      }
      game.debugSetHand(playerName, cardNames);
    },
    { playerName, cardNames }
  );

  await page.waitForFunction(
    (expected) => document.querySelectorAll('#hand-cards .card').length === expected,
    cardNames.length
  );
}

async function performAttack(page: Page, targetName: string, cardName: string) {
  const card = page.locator('#hand-cards .card', { hasText: cardName }).first();
  await card.waitFor({ state: 'visible' });
  await card.click();

  const confirmBtn = page.locator('#confirm-btn');
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  const targetBtn = page.locator('#target-selection-modal .target-player-btn', {
    hasText: targetName
  });
  await targetBtn.first().waitFor({ state: 'visible' });
  await targetBtn.first().click();
}

async function waitForDefenseRequest(page: Page) {
  await page.waitForFunction(() => {
    const game = (window as any).game;
    return Boolean(game && game.pendingDefenseRequestId);
  });
}

async function selectDefenseCard(page: Page, cardName: string) {
  const card = page.locator('#hand-cards .card', { hasText: cardName }).first();
  await card.waitFor({ state: 'visible' });
  await card.click();

  const confirmBtn = page.locator('#confirm-btn');
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();
}

async function waitForDefenseClear(page: Page) {
  await page.waitForFunction(() => {
    const game = (window as any).game;
    return Boolean(game && !game.pendingDefenseRequestId);
  });
}

async function expectLogContains(page: Page, text: string) {
  await page.waitForFunction(
    (content) =>
      Array.from(document.querySelectorAll('#game-log .log-message')).some((node) =>
        node.textContent?.includes(content)
      ),
    text
  );
}

function attachLogging(page: Page, label: string) {
  page.on('console', (msg) => console.log(`[${label}][console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (error) => console.log(`[${label}][pageerror] ${error.message}`));
}

function generatePlayerName(prefix: string): string {
  // Input field enforces max length 12, so keep generated names short
  return `${prefix}${Math.random().toString(36).slice(-5)}`;
}
