// Shared steps for the Playwright tests. Every test gets a fresh browser context, so storage starts empty.
import { expect } from '@playwright/test';

/** First visit: create a project and close Grunnlag, leaving the studio open on the example home. */
export async function openStudio(page) {
  await page.goto('/studio/index.html');
  await page.locator('#first-project-btn').click();
  await page.locator('#create-project-submit').click();
  await page.locator('#ground-cancel').click();
  await expect(page.locator('#app-dialog')).not.toBeVisible();
}

/** Stue (a) and Soverom (b) side by side, 4 × 4 m each, with a sofa in Stue. */
export async function loadTwoRooms(page) {
  await page.evaluate(() => {
    const room = (id, name, x, type) => ({ id, name, type, x, y: 0, w: 200, h: 200, color: '#e8e1d1', width: 4, height: 4, area: 16 });
    window.romly.editor.loadState({ variant: 'custom', walls: [], rooms: [room('a', 'Stue', 0, 'living'), room('b', 'Soverom', 200, 'bedroom')], items: [{ id: 's', type: 'sofa', x: 100, y: 120, rotation: 0, width: 1.6, depth: 0.8 }] });
  });
}

/** Where a point in the plan (plan units) is on the screen. */
export const toScreen = (page, x, y) => page.evaluate(([px, py]) => {
  const svg = document.querySelector('#floorplan svg'), point = svg.createSVGPoint();
  point.x = px; point.y = py;
  const mapped = point.matrixTransform(svg.getScreenCTM());
  return { x: mapped.x, y: mapped.y };
}, [x, y]);

export const plan = page => page.evaluate(() => window.romly.editor.getState());
