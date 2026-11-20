import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const speakeasy = require('speakeasy');

export const TEST_EMAIL = 'browser-suite@example.test';
export const TEST_PASSWORD = 'BrowserTestPass123!';
export const TEST_SEED = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const FIXTURE_SLUG = 'browser-fixture-project';

function assertIsolatedDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required for browser tests');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/studio_test') {
    throw new Error('Use disposable local studio_test database for browser tests');
  }
}

async function cleanDatabase(db) {
  const owners = await db.administrator.findMany();
  for (const owner of owners) {
    await db.session.deleteMany({ where: { adminId: owner.id } });
    await db.securityEvent.deleteMany({ where: { adminId: owner.id } });
    await db.passwordResetToken.deleteMany({ where: { adminId: owner.id } });
    await db.backupCode.deleteMany({ where: { adminId: owner.id } });
    await db.mfaSecret.deleteMany({ where: { adminId: owner.id } });
    await db.auditLog.deleteMany({ where: { adminId: owner.id } });
    await db.administrator.delete({ where: { id: owner.id } });
  }
  await db.project.deleteMany({ where: { OR: [{ slug: FIXTURE_SLUG }, { slug: { startsWith: 'browser-test-' } }] } });
  await db.websiteSetting.deleteMany({ where: { key: { startsWith: 'browser.test.' } } });
}

async function seedDatabase() {
  assertIsolatedDatabase();
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET ||= 'browser-test-session-secret-at-least-32-chars';
  process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const { db } = require('../dist/src/config/db');
  const { provision } = require('../dist/src/lib/owner');
  await cleanDatabase(db);
  const backupCodes = await provision(TEST_EMAIL, TEST_PASSWORD, TEST_SEED);
  await db.project.create({
    data: {
      slug: FIXTURE_SLUG,
      name: 'Browser Fixture Project',
      status: 'PUBLISHED',
      sortOrder: 1,
    },
  });
  return { db, backupCodes };
}

export const test = base.extend({
  seededDb: async ({}, use) => {
    const fixture = await seedDatabase();
    try {
      await use(fixture);
    } finally {
      await cleanDatabase(fixture.db);
    }
  },
  authenticatedPage: async ({ browser, baseURL, seededDb }, use) => {
    assertIsolatedDatabase();
    void seededDb;
    const apiContext = await browser.newContext({ baseURL });
    const csrfResponse = await apiContext.request.get('/api/admin/auth/csrf-token');
    const csrf = (await csrfResponse.json()).csrfToken;
    const login = await apiContext.request.post('/api/admin/auth/login', {
      headers: { 'X-CSRF-Token': csrf },
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    if (!login.ok()) throw new Error(`Browser fixture login failed: ${await login.text()}`);
    const factorCsrf = (await login.json()).csrfToken;
    const verify = await apiContext.request.post('/api/admin/auth/login/mfa', {
      headers: { 'X-CSRF-Token': factorCsrf },
      data: { token: speakeasy.totp({ secret: TEST_SEED, encoding: 'base32' }) },
    });
    if (!verify.ok()) throw new Error(`Browser fixture MFA failed: ${await verify.text()}`);
    const storageState = await apiContext.storageState();
    await apiContext.close();

    const context = await browser.newContext({ baseURL, storageState });
    const page: Page = await context.newPage();
    await page.goto('/admin/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
