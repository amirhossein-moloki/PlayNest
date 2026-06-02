import { test, expect } from '@playwright/test';

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uSWQiOiJzLTEiLCJhY3RvcklkIjoidS0xIiwiYWN0b3JUeXBlIjoiVVNFUiIsImlhdCI6MTc4MDM0OTE3MiwiZXhwIjoxNzgwMzUwMDcyfQ.7hU84IaZ5movFlcXzK82A17nSguE_JxFBRTPurL2fP4';

test.describe('CMS Admin UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${MOCK_TOKEN}`
    });
  });

  test('should navigate through CMS admin pages', async ({ page }) => {
    await page.goto('/api/v1/admin/gamingCenters/gc-1/pages');
    await expect(page.locator('h1')).toContainText('CMS Pages');
  });
});
