import { expect, test } from '@playwright/test';

test('tutorial and QA page is publicly readable', async ({ page }) => {
  await page.goto('/learn');

  await expect(page.getByRole('heading', {
    name: 'How to use Strategy Doctor',
  })).toBeVisible();
  await expect(page.getByText('What if natural-language parsing fails?'))
    .toBeVisible();
  await expect(page.getByRole('link', {
    name: 'Open workspace',
  })).toHaveAttribute('href', '/showcase');
});
