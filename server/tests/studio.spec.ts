import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Portfolio Studio — login and MFA', () => {
  test('login page loads with accessible form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Authentication code')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('rejects empty credentials with validation', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Continue' }).click();
    // HTML5 required attribute should prevent submission
    await expect(page.getByLabel('Email')).toHaveAttribute('required');
    await expect(page.getByLabel('Password')).toHaveAttribute('required');
  });

  test('MFA step shows token field after password step', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('admin@test.example.com');
    await page.getByLabel('Password').fill('testpass123');
    await page.getByRole('button', { name: 'Continue' }).click();
    // After password submit, token field should appear
    await expect(page.getByLabel('Authentication code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify and sign in' })).toBeVisible();
  });
});

test.describe('Portfolio Studio — project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Tests assume an authenticated session is established via setup
    // or that the test environment provides a logged-in state
  });

  test('project list page loads with table and filters', async ({ page }) => {
    await page.goto('/admin/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByLabel('Filter by status')).toBeVisible();
    await expect(page.getByRole('button', { name: /New Project/ })).toBeVisible();
  });

  test('status filter shows All, Published, Draft, Archived options', async ({ page }) => {
    await page.goto('/admin/projects');
    const select = page.getByLabel('Filter by status');
    await expect(select).toContainText('All statuses');
    await expect(select).toContainText('Published');
    await expect(select).toContainText('Draft');
    await expect(select).toContainText('Archived');
  });

  test('create project form submits with all fields', async ({ page }) => {
    await page.goto('/admin/projects');
    await page.getByRole('button', { name: /New Project/ }).click();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Slug')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    await page.getByLabel('Name').fill('Browser Test Project');
    await page.getByLabel('Slug').fill('browser-test-project');
    await page.getByLabel('Status').selectOption('DRAFT');
    await page.getByRole('button', { name: 'Create' }).click();
    // Should return to list with success toast
    await expect(page.locator('.toast.success')).toBeVisible();
  });

  test('edit project form updates by slug', async ({ page }) => {
    await page.goto('/admin/projects');
    await page.getByRole('button', { name: /Edit/ }).first().click();
    await expect(page.getByLabel('Name')).toBeVisible();
    await page.getByLabel('Name').fill('Updated Name');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.toast.success')).toBeVisible();
  });

  test('delete project confirms and removes', async ({ page }) => {
    await page.goto('/admin/projects');
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.toast.success')).toBeVisible();
  });
});

test.describe('Portfolio Studio — security page', () => {
  test('security page shows MFA and session info', async ({ page }) => {
    await page.goto('/admin/security');
    await expect(page.getByRole('heading', { name: 'Multi-factor authentication' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
  });
});
