import { test, expect } from './fixtures';
import { randomUUID } from 'node:crypto';

test('public work: lists published projects, updates content and opens direct detail URLs', async ({ page, seededDb }) => {
  const slug = `browser-test-public-${randomUUID()}`;
  const draftSlug = `browser-test-draft-${randomUUID()}`;
  const name = `Published Browser Project ${randomUUID()}`;
  const updatedName = `Updated Browser Project ${randomUUID()}`;
  await seededDb.db.project.createMany({
    data: [
      {
        slug,
        name,
        label: 'Public browser project',
        summary: 'Initial summary',
        detail: 'Initial detail',
        status: 'PUBLISHED',
        sortOrder: 1,
      },
      { slug: draftSlug, name: 'Draft Browser Project', status: 'DRAFT', sortOrder: 2 },
    ],
  });

  await page.goto('/work/');
  const list = page.locator('[data-public-projects]');
  await expect(list.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  await expect(list.getByText('Draft Browser Project')).toHaveCount(0);
  await expect(list.getByRole('link', { name: /Browser Fixture Project/ })).toBeVisible();

  await seededDb.db.project.update({
    where: { slug },
    data: { name: updatedName, summary: 'Updated summary', detail: 'Updated detail' },
  });
  await page.reload();
  await expect(list.getByRole('link', { name: new RegExp(updatedName) })).toBeVisible();

  await page.goto(`/work/${slug}/`);
  await expect(page.locator('[data-project-name]')).toHaveText(updatedName);
  await expect(page.locator('[data-project-summary]')).toHaveText('Updated summary');
  await expect(page.locator('p[data-project-detail]')).toHaveText('Updated detail');
  await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
});

test('public work: keeps the built-in listing when the API is unavailable', async ({ page }) => {
  await page.route('**/api/public/projects', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' })
  );
  await page.goto('/work/');
  await expect(page.getByRole('link', { name: /MafutaWatch/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tunza/ })).toBeVisible();
  await expect(page.getByText(/Showing the built-in project list/)).toBeVisible();
});

test('public work: hides draft details and reports detail API failures', async ({ page, seededDb }) => {
  const draftSlug = `browser-test-draft-${randomUUID()}`;
  await seededDb.db.project.create({
    data: { slug: draftSlug, name: 'Unpublished Browser Project', status: 'DRAFT', sortOrder: 1 },
  });

  await page.goto(`/work/${draftSlug}/`);
  await expect(page.getByRole('heading', { name: 'Project unavailable' })).toBeVisible();
  await expect(page.getByText('This project is not available.')).toBeVisible();
  await expect(page.getByText('Unpublished Browser Project')).toHaveCount(0);

  await page.route('**/api/public/projects/**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' })
  );
  await page.goto('/work/mafuta-watch/');
  await expect(page.getByRole('heading', { name: 'Project unavailable' })).toBeVisible();
  await expect(page.getByText(/couldn’t load this project right now/)).toBeVisible();
});
