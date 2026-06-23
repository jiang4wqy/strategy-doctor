import { expect, test } from '@playwright/test';

test('judge mode is publicly readable without workspace authentication', async ({ page }) => {
  await page.goto('/judge');

  await expect(page.getByRole('heading', {
    name: 'Strategy Doctor',
  })).toBeVisible();
  await expect(page.getByText('Bitget AI Hackathon judge mode')).toBeVisible();
  await expect(page.getByText('/api/v1/playbook/diagnoses')).toBeVisible();
  await expect(page.getByRole('link', {
    name: 'Open private workspace',
  })).toHaveAttribute('href', '/showcase');
});
