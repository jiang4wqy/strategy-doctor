import { expect, test } from '@playwright/test';
import {
  diagnose,
  login,
  parseDescription,
  RSI_DESCRIPTION,
} from './fixtures.ts';

test('English RSI strategy reaches diagnosis and local history', async ({
  page,
}) => {
  await login(page);
  await parseDescription(page, RSI_DESCRIPTION);

  await expect(
    page.getByRole('heading', {
      name: 'RSI + Bollinger Mean Reversion',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Parser assumptions' }),
  ).toBeVisible();
  await expect(page.locator('#parameter-rsiPeriod')).toHaveValue('10');
  await expect(page.locator('#parameter-bollingerPeriod')).toHaveValue('14');
  await expect(page.locator('#parameter-trendFilterPeriod'))
    .toHaveValue('30');

  await diagnose(page);

  await expect(page.getByTestId('scenario-row')).toHaveCount(5);
  await expect(
    page.getByRole('heading', { name: 'Prescription rationale' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Held-out equity comparison' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Five-dimension risk radar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Scenario damage timeline' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Parameter changes' }),
  ).toBeVisible();
  await expect(page.getByText('Request ID')).toBeVisible();
  await expect(page.locator('.developer-panel code')).toContainText('req_');

  await page.reload();
  await page.getByLabel('Access code').fill('e2e-code');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page
    .getByRole('button', { name: 'Open diagnosis' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Diagnosis summary' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'RSI Bollinger trend-filtered mean reversion',
    }),
  ).toBeVisible();
});
