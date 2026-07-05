import { test, expect } from '@playwright/test';

test.describe('Modern Outliner smoke', () => {
  test('seed', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('textbox', { name: /search tabs/i })).toBeVisible();
    await expect(page.getByText('Current Session')).toBeVisible();
    await expect(page.getByRole('button', { name: /backup/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add group/i })).toBeVisible();
  });
});
