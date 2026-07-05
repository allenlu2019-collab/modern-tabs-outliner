// spec: specs/modern-outliner-core-flows.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Fresh Session Shell', () => {
  test('Render Primary Controls', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Locate the search input.
    await expect(page.getByPlaceholder('Search tabs, windows, groups... (Ctrl+F)')).toBeVisible();

    // 3. Locate the session root heading.
    await expect(page.getByText('Current Session')).toBeVisible();

    // 4. Locate the Backup & Restore button.
    await expect(page.getByRole('button', { name: 'Backup & Restore' })).toBeVisible();

    // 5. Locate the Add Group button.
    await expect(page.getByRole('button', { name: 'Add Group' })).toBeVisible();
  });
});

test.describe('Backup And Restore Modal', () => {
  test('Open And Close Backup Modal', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Click Backup & Restore.
    await page.getByRole('button', { name: 'Backup & Restore' }).click();

    // 3. Verify the modal content.
    await expect(page.getByRole('heading', { name: /Backup & Restore/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Current State' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export JSON/ })).toBeVisible();
    await expect(page.getByText(/Import JSON/)).toBeVisible();
    await expect(page.getByText('GitHub Cloud Sync')).toBeVisible();
    await expect(page.getByText('Local Snapshots')).toBeVisible();
    await expect(page.getByText('No backups found.')).toBeVisible();

    // 4. Click the close button.
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('heading', { name: /Backup & Restore/ })).toBeHidden();
  });

  test('Create Empty Snapshot', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Open Backup & Restore.
    await page.getByRole('button', { name: 'Backup & Restore' }).click();

    // 3. Click `Save Current State`.
    await page.getByRole('button', { name: 'Save Current State' }).click();

    await expect(page.getByText('0 items')).toBeVisible();
    await expect(page.getByText('No backups found.')).toBeHidden();
  });

  test('Export Empty JSON Backup', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Open Backup & Restore.
    await page.getByRole('button', { name: 'Backup & Restore' }).click();

    // 3. Click `Export JSON`.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export JSON/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^modern-outliner-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test.describe('GitHub Sync Settings Validation', () => {
  test('Show GitHub Settings', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Open Backup & Restore.
    await page.getByRole('button', { name: 'Backup & Restore' }).click();

    // 3. Click `GitHub Cloud Sync`.
    await page.getByText('GitHub Cloud Sync').click();

    await expect(page.getByText('Personal Access Token (PAT)')).toBeVisible();
    await expect(page.getByPlaceholder('ghp_...')).toBeVisible();
    await expect(page.getByText('GitHub Repository')).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await expect(page.getByText('File Path in Repo')).toBeVisible();
    await expect(page.getByPlaceholder('tabs.json')).toHaveValue('tabs.json');
    await expect(page.getByRole('button', { name: /Push/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pull/ })).toBeVisible();
  });

  test('Reject Push Without Required Settings', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Open Backup & Restore.
    await page.getByRole('button', { name: 'Backup & Restore' }).click();

    // 3. Expand GitHub Cloud Sync.
    await page.getByText('GitHub Cloud Sync').click();

    // 4. Click Push without entering token, repo, or path.
    await page.getByRole('button', { name: /Push/ }).click();

    await expect(page.getByText('Please fill in all GitHub settings first.')).toBeVisible();
  });
});

test.describe('Group Creation And Search', () => {
  test('Add Group In Fresh Session', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Click Add Group.
    await page.getByRole('button', { name: 'Add Group' }).click();

    await expect(page.getByText('NEW GROUP')).toBeVisible();
    await expect(page.getByText('(0)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore all in group' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('Search Existing Group', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Click Add Group.
    await page.getByRole('button', { name: 'Add Group' }).click();

    // 3. Type `new` into the search input.
    const search = page.getByPlaceholder('Search tabs, windows, groups... (Ctrl+F)');
    await search.fill('new');

    await expect(page.getByText(/Search Results/)).toBeVisible();
    await expect(page.getByText('NEW GROUP')).toBeVisible();

    await search.fill('');
    await expect(page.getByText('Current Session')).toBeVisible();
  });
});

test.describe('State Persistence', () => {
  test('Persist Added Group Across Reload', async ({ page }) => {
    // 1. Navigate to `/`.
    await page.goto('/');

    // 2. Click Add Group.
    await page.getByRole('button', { name: 'Add Group' }).click();

    // 3. Verify `NEW GROUP` appears.
    await expect(page.getByText('NEW GROUP')).toBeVisible();

    // 4. Reload the page.
    await page.reload();

    await expect(page.getByText('NEW GROUP')).toBeVisible();
    await expect(page.getByText('Current Session')).toBeVisible();
    await expect(page.getByPlaceholder('Search tabs, windows, groups... (Ctrl+F)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Backup & Restore' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Group' })).toBeVisible();
  });
});
