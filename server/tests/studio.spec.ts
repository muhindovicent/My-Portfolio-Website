import { test, expect, TEST_EMAIL, TEST_PASSWORD, TEST_SEED, FIXTURE_SLUG } from './fixtures';

const speakeasy = require('speakeasy');

test.describe('Portfolio Studio — authentication', () => {
  test('completes password and MFA login with an enabled verification button', async ({ page, seededDb }) => {
    void seededDb;
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);

    const submit = page.getByRole('button', { name: 'Continue' });
    await expect(submit).toBeEnabled();
    await submit.click();

    const code = page.getByLabel('Authentication code');
    await expect(code).toBeVisible();
    const verify = page.getByRole('button', { name: 'Verify and sign in' });
    await expect(verify).toBeEnabled();
    await expect(submit).toHaveCount(0);

    await code.fill(speakeasy.totp({ secret: TEST_SEED, encoding: 'base32' }));
    await verify.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  });

  test('backup-code login succeeds and is single-use', async ({ page, browser, baseURL, seededDb }) => {
    const code = seededDb.backupCodes[0];
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Authentication code').fill(code);
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

    const replayContext = await browser.newContext({ baseURL });
    const replay = await replayContext.newPage();
    await replay.goto('/admin/login');
    await replay.getByLabel('Email').fill(TEST_EMAIL);
    await replay.getByLabel('Password').fill(TEST_PASSWORD);
    await replay.getByRole('button', { name: 'Continue' }).click();
    await replay.getByLabel('Authentication code').fill(code);
    await replay.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(replay.getByRole('alert')).toContainText('Invalid verification code');
    await replayContext.close();
  });
});

test.describe('Portfolio Studio — project CRUD', () => {
  test('creates a project through the modal form', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const slug = `browser-test-${Date.now()}`;
    await page.getByRole('button', { name: /New Project/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const create = dialog.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toHaveAttribute('form', /studio-modal-form-/);
    await dialog.getByLabel('Name').fill('Browser Created Project');
    await dialog.getByLabel('Slug').fill(slug);
    await dialog.getByLabel('Status').selectOption('DRAFT');
    await create.click();

    await expect(page.locator('.toast.success')).toBeVisible();
    await expect(page.getByText('Browser Created Project')).toBeVisible();
    await expect(page.getByText(slug)).toBeVisible();
  });

  test('edits a project by slug through the modal form', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const row = page.locator('tr', { hasText: FIXTURE_SLUG });
    await row.getByRole('button', { name: /Edit Project/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Name')).toHaveValue('Browser Fixture Project');
    await dialog.getByLabel('Name').fill('Browser Updated Project');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.locator('.toast.success')).toBeVisible();
    await expect(page.getByText('Browser Updated Project')).toBeVisible();
    await expect(row).toContainText('Browser Updated Project');
  });

  test('deletes a project by slug after confirmation', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const row = page.locator('tr', { hasText: FIXTURE_SLUG });
    await row.getByRole('button', { name: /Delete Project/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('.toast.success')).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('filters projects by status', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.getByLabel('Filter by status').selectOption('PUBLISHED');
    await expect(page.locator('tr', { hasText: FIXTURE_SLUG })).toBeVisible();
    await page.getByLabel('Filter by status').selectOption('DRAFT');
    await expect(page.locator('tr', { hasText: FIXTURE_SLUG })).toHaveCount(0);
  });
});

test.describe('Portfolio Studio — settings', () => {
  test('creates the first setting without duplicating the page', async ({ authenticatedPage, seededDb }) => {
    void seededDb;
    const page = authenticatedPage;
    await page.goto('/admin/settings');

    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(1);
    await expect(page.getByText('No settings')).toBeVisible();
    await page.getByRole('button', { name: /New setting/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Key').fill('browser.test.first');
    await dialog.getByLabel('Value (JSON)').fill('{"enabled":true}');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('.toast.success')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(1);
    await expect(page.locator('table')).toHaveCount(1);
    await expect(page.getByText('browser.test.first')).toBeVisible();
  });
});

test.describe('Portfolio Studio — confirmation dismissal', () => {
  for (const dismissal of ['Escape', 'backdrop', 'close button'] as const) {
    test(`resolves a canceled confirmation via ${dismissal}`, async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const row = page.locator('tr', { hasText: FIXTURE_SLUG });
      await row.getByRole('button', { name: /Delete Project/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      if (dismissal === 'Escape') {
        await page.keyboard.press('Escape');
      } else if (dismissal === 'backdrop') {
        await page.locator('.modal-backdrop').click({ position: { x: 4, y: 4 } });
      } else {
        await dialog.getByRole('button', { name: 'Close dialog' }).click();
      }

      await expect(dialog).toHaveCount(0);
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: /Delete Project/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.locator('.toast.success')).toBeVisible();
      await expect(row).toHaveCount(0);
    });
  }
});

test.describe('Portfolio Studio — security page', () => {
  test('shows MFA and session information', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/admin/security');
    await expect(page.getByRole('heading', { name: 'Multi-factor authentication' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
  });
});
