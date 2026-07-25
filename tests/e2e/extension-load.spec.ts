import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('compiled extension registers its service worker', async () => {
  const extensionPath = resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let [worker] = context.serviceWorkers();
    worker ||= await context.waitForEvent('serviceworker');
    expect(worker.url()).toContain('/background.js');
  } finally {
    await context.close();
  }
});
