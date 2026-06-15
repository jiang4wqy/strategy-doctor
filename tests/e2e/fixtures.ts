import { expect, type Page } from '@playwright/test';

export const RSI_DESCRIPTION =
  'BTC 4小时 RSI 10 配合布林带 14，趋势过滤周期 30';

export const MA_DESCRIPTION =
  'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30';

export async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Access code').fill('e2e-code');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Describe the strategy' }),
  ).toBeVisible();
}

export async function parseDescription(
  page: Page,
  description: string,
): Promise<void> {
  await page.getByLabel('Strategy description').fill(description);
  await page.getByRole('button', { name: 'Parse strategy' }).click();
}

export async function diagnose(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Confirm and diagnose' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Diagnosis summary' }),
  ).toBeVisible();
}
