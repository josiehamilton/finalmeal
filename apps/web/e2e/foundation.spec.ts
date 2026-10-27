import { expect, test } from '@playwright/test';
import { BROKEN_API_URL } from '../playwright.config';

test.describe('foundation page with the local database', () => {
  test('shows the wordmark heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Final Meal' })).toBeVisible();
  });

  test('shows live counts from Supabase', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('6 people · 14 places · 17 dishes')).toBeVisible();
  });

  test('paints the night background', async ({ page }) => {
    await page.goto('/');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe('rgb(11, 10, 9)');
  });

  test('sets the heading in Instrument Serif', async ({ page }) => {
    await page.goto('/');
    const family = await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('Instrument Serif');
  });

  test('shows the tagline, skull and four swatches', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Five dishes. That’s it. Choose.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Final Meal' })).toBeVisible();
    for (const name of ['Ember', 'Ember Glow', 'Bone', 'Night']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
  });
});

test.describe('foundation page when the API is unreachable', () => {
  test('keeps the page and says the kitchen is unreachable', async ({ page }) => {
    const started = Date.now();
    const response = await page.goto(`${BROKEN_API_URL}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Final Meal' })).toBeVisible();
    await expect(page.getByText('Can’t reach the kitchen right now.')).toBeVisible();
    // The visitor must not stare at a blank tab while the backend is down.
    expect(Date.now() - started).toBeLessThan(3000);
    await expect(page.getByText(/people/)).toHaveCount(0);
  });
});
