import { AxeBuilder } from '@axe-core/playwright';
import {
  expect,
  test,
  type Page,
  type TestInfo,
} from '@playwright/test';
import {
  diagnose,
  login,
  parseDescription,
  RSI_DESCRIPTION,
} from './fixtures.ts';

async function expectNoHighImpactViolations(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const highImpact = results.violations.filter(
    violation => (
      violation.impact === 'serious'
      || violation.impact === 'critical'
    ),
  );
  await testInfo.attach('axe-results', {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: 'application/json',
  });
  expect(highImpact).toEqual([]);
}

test('login and populated workspace have no serious accessibility violations',
  async ({ page }, testInfo) => {
    await page.goto('/');
    await expectNoHighImpactViolations(page, testInfo);

    await login(page);
    await parseDescription(page, RSI_DESCRIPTION);
    await diagnose(page);
    await expectNoHighImpactViolations(page, testInfo);
  });
