import { test, expect } from '@playwright/test';

test('Journey: Payment Callback', async ({ page }) => {
  await page.goto('/api/v1/payments/callback?Authority=A&Status=OK');
  expect(page.url()).toContain('pages');
});
