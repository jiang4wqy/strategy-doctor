import { defineConfig, devices } from '@playwright/test';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
    },
  }],
  webServer: {
    command: `${npm} run web`,
    url: 'http://127.0.0.1:8080/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DOCTOR_WEB_ACCESS_CODE: 'e2e-code',
      DOCTOR_SESSION_SECRET:
        'e2e-session-secret-at-least-32-characters',
      DOCTOR_API_KEYS: 'e2e-api-key',
      DOCTOR_HOST: '127.0.0.1',
      DOCTOR_PORT: '8080',
      DOCTOR_NL_AI_ENABLED: '0',
      DOCTOR_LLM_NARRATE: '0',
    },
  },
});
