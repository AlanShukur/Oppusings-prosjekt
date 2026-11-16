// Mouse and keyboard in the 2D drawing, in Chromium, Firefox and WebKit.
import { test, expect } from '@playwright/test';
import { openStudio, loadTwoRooms, toScreen, plan } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await loadTwoRooms(page);
});

test('a project and its drawing survive a reload', async ({ page }) => {
  // The status text can still say "saved" from before the plan changed, so wait for the save itself.
  await expect.poll(() => page.evaluate(() => window.romly.getSync().dirty)).toBe(false);
  await expect(page.locator('#save-status')).toContainText('Lagret på denne enheten');
  await page.reload();
  await expect.poll(async () => (await plan(page)).rooms.map(room => room.name)).toEqual(['Stue', 'Soverom']);
});

test('clicking a wall opens the wall panel', async ({ page }) => {
  const wall = await toScreen(page, 200, 60);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.locator('#wall-properties')).toBeVisible();
  await expect(page.locator('#wall-title')).toHaveText('Innervegg');
  await expect(page.locator('#wall-between')).toHaveText('Mellom Stue og Soverom');
});

test('dragging a sofa moves it, and undo puts it back', async ({ page }) => {
  const from = await toScreen(page, 100, 120), to = await toScreen(page, 140, 60);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  const moved = (await plan(page)).items[0];
  expect([moved.x, moved.y]).toEqual([140, 60]);
  await expect(page.locator('#item-title')).toHaveText('Sofa, 3 seter');
  await page.keyboard.press('Control+z');
  const back = (await plan(page)).items[0];
  expect([back.x, back.y]).toEqual([100, 120]);
});

test('the room tool draws a room by dragging', async ({ page }) => {
  await page.evaluate(() => window.romly.editor.setZoom(50));
  await page.locator('[data-tool="room"]').click();
  const from = await toScreen(page, 100, 260), to = await toScreen(page, 300, 400);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const rooms = (await plan(page)).rooms;
  expect(rooms).toHaveLength(3);
  // Screen pixels round to the 5 cm grid, so allow one grid step.
  for (const [value, expected] of [[rooms[2].x, 100], [rooms[2].y, 260], [rooms[2].w, 200], [rooms[2].h, 140]]) expect(Math.abs(value - expected)).toBeLessThanOrEqual(2.5);
});

test('the mouse wheel zooms around the pointer', async ({ page }) => {
  const centre = await toScreen(page, 200, 100);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => page.evaluate(() => window.romly.editor.zoom)).toBeGreaterThan(100);
  await expect(page.locator('#zoom-value')).not.toHaveText('100 %');
});

test('the drawing works from the keyboard: N selects, arrows move, Delete removes', async ({ page }) => {
  await page.locator('#floorplan').focus();
  await page.keyboard.press('n');
  await expect(page.locator('#canvas-status')).toHaveText('Sofa, 3 seter valgt.');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const moved = (await plan(page)).items[0];
  expect([moved.x, moved.y]).toEqual([105, 145]);
  await page.keyboard.press('Delete');
  expect((await plan(page)).items).toHaveLength(0);
  await expect(page.locator('#floorplan')).toBeFocused();
});
