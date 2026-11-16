// Touch on a phone-sized screen, in Chromium (Pixel 7) and WebKit (iPhone 14).
import { test, expect } from '@playwright/test';
import { openStudio, loadTwoRooms, toScreen, plan } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await loadTwoRooms(page);
});

/**
 * Two fingers on the drawing, moved apart or together. Chromium takes real touch points over the DevTools protocol.
 * Playwright has no multi-touch for WebKit, so there the same finger movements are sent as touch pointer events.
 */
async function pinch(page, browserName, centre, fromSpread, toSpread) {
  const spreads = Array.from({ length: 5 }, (_, i) => fromSpread + (toSpread - fromSpread) * (i + 1) / 5);
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    const points = spread => [{ x: centre.x - spread, y: centre.y, id: 0 }, { x: centre.x + spread, y: centre.y, id: 1 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(fromSpread) });
    for (const spread of spreads) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(spread) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await page.evaluate(([x, y, first, steps]) => {
    const target = document.querySelector('#floorplan'); // not the svg inside it: the editor replaces that on every render
    const send = (type, id, dx) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x + dx, clientY: y, button: 0, bubbles: true, cancelable: true }));
    send('pointerdown', 1, -first); send('pointerdown', 2, first);
    for (const spread of steps) { send('pointermove', 1, -spread); send('pointermove', 2, spread); }
    send('pointerup', 1, -steps.at(-1)); send('pointerup', 2, steps.at(-1));
  }, [centre.x, centre.y, fromSpread, spreads]);
}

test('a tap selects the room under the finger', async ({ page }) => {
  expect(await page.evaluate(() => window.romly.editor.selected)).toBe('a');
  const bedroom = await toScreen(page, 300, 60);
  await page.touchscreen.tap(bedroom.x, bedroom.y);
  await expect.poll(() => page.evaluate(() => window.romly.editor.selected)).toBe('b');
  await page.locator('[data-workspace-panel="properties"]').tap();
  await expect(page.locator('#selected-room-title')).toHaveText('Soverom');
});

test('two fingers zoom in and out without changing the drawing', async ({ page, browserName }) => {
  const before = JSON.stringify(await plan(page));
  const centre = await toScreen(page, 200, 100);
  await pinch(page, browserName, centre, 30, 90);
  await expect.poll(() => page.evaluate(() => Math.round(window.romly.editor.zoom))).toBe(300);
  await expect(page.locator('#zoom-value')).toHaveText('300 %');
  await pinch(page, browserName, centre, 90, 30);
  await expect.poll(() => page.evaluate(() => Math.round(window.romly.editor.zoom))).toBe(100);
  expect(JSON.stringify(await plan(page))).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a finger drags a sofa', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright can only drag with a real touch point in Chromium.');
  const from = await toScreen(page, 100, 120), to = await toScreen(page, 140, 60);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 0 }] });
  for (let i = 1; i <= 4; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 4, y: from.y + (to.y - from.y) * i / 4, id: 0 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => { const sofa = (await plan(page)).items[0]; return [sofa.x, sofa.y]; }).toEqual([140, 60]);
});
