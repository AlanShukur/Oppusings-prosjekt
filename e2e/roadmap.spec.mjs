// The roadmap to «Send søknad» in Chromium, Firefox and WebKit.
import { test, expect } from '@playwright/test';
import { openStudio, loadTwoRooms } from './helpers.mjs';

test('a new project opens on its roadmap, and a step leads to the right place', async ({ page }) => {
  await page.goto('/studio/index.html');
  await page.locator('#first-project-btn').click();
  await page.locator('#create-project-submit').click();
  const roadmap = page.locator('#roadmap');
  await expect(page.locator('#dialog-title')).toHaveText('Veien til søknad');
  await expect(roadmap.locator('[data-status="done"]')).toHaveCount(1);
  await expect(roadmap.locator('[data-status="next"]')).toHaveAttribute('data-step', 'ground');
  await expect(roadmap.locator('[data-branch="soknad"] .roadmap-step').last()).toContainText('Send søknad');
  await roadmap.getByRole('button', { name: 'Åpne grunnlaget' }).click();
  await expect(page.locator('#dialog-title')).toHaveText('La oss bli kjent med hjemmet ditt');
});

test('removing a load-bearing wall leads down to «Send søknad», and a step can be ticked by keyboard', async ({ page }) => {
  await openStudio(page);
  await loadTwoRooms(page);
  await page.evaluate(() => { window.romly.editor.setBaseline(); window.romly.editor.updateWall('a:right|b:left', { status: 'demolish', loadBearing: 'yes' }); });
  await expect(page.locator('#roadmap-label')).toHaveText('Veikart · 4 av 11');
  await page.locator('#roadmap-btn').click();
  await expect(page.locator('#roadmap [data-branch="soknad"]')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#roadmap [data-branch="ingen"]')).toHaveAttribute('data-active', 'false');
  await page.locator('[data-roadmap-flag="neighbours"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#roadmap [data-step="neighbours"]')).toHaveAttribute('data-status', 'done');
  await expect(page.locator('[data-roadmap-flag="neighbours"]')).toBeFocused();
  await page.locator('[data-roadmap-action="send"]').click();
  await expect(page.locator('#dialog-title')).toHaveText('Send søknad');
  await expect(page.locator('#dialog-content')).toContainText('Romly sender ingenting');
});
