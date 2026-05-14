import { test, expect } from '@playwright/test';

test.describe.skip('profile chrome (requires live Supabase + seeded holden row)', () => {
  test('profile page renders chrome', async ({ page }) => {
    await page.goto('/holden');
    await expect(page.getByText('$ holden')).toBeVisible();
    await expect(page.getByText(/streak/i)).toBeVisible();
    await expect(page.getByText('· builds')).toBeVisible();
    await expect(page.getByText('· activity')).toBeVisible();
    await expect(page.getByText('· persona')).toBeVisible();
    await expect(page.getByRole('img', { name: /52-week activity heatmap/i })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/profile.png', fullPage: true });
  });
});
