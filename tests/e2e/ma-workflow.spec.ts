import { expect, test } from '@playwright/test';
import {
  diagnose,
  login,
  MA_DESCRIPTION,
  parseDescription,
} from './fixtures.ts';

test('English moving-average strategy completes the short workflow', async ({
  page,
}) => {
  await login(page);
  await parseDescription(page, MA_DESCRIPTION);

  await expect(
    page.getByRole('heading', { name: 'Moving Average Crossover' }),
  ).toBeVisible();
  await expect(page.locator('#parameter-fastMA')).toHaveValue('8');
  await expect(page.locator('#parameter-slowMA')).toHaveValue('30');

  await diagnose(page);

  await expect(page.getByRole('region', {
    name: 'Diagnosis summary',
  })).toBeVisible();
  await expect(page.getByTestId('scenario-row')).toHaveCount(5);
});
