import { test, expect } from './fixtures';
import { randomUUID } from 'node:crypto';

for (const [resource, label, titleField, detailField] of [
  ['education', 'Education', 'Institution', 'Degree'],
  ['experience', 'Experience', 'Company', 'Role'],
  ['certifications', 'Certification', 'Title', 'Issuer'],
  ['skills', 'Skill', 'Name', 'Category'],
]) {
  test(`${resource}: create, edit and delete`, async ({ authenticatedPage: page }) => {
    const title = `Smoke ${randomUUID()}`;
    await page.goto(`/admin/${resource}`);
    await page.getByRole('button', { name: `New ${label}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(titleField).fill(title);
    await dialog.getByLabel(detailField).fill('Initial detail');
    await dialog.getByRole('button', { name: 'Create' }).click();
    const row = page.getByRole('row').filter({ hasText: title });
    await expect(row).toContainText('Initial detail');
    await row.getByRole('button', { name: `Edit ${label}` }).click();
    await dialog.getByLabel(detailField).fill('Updated detail');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(row).toContainText('Updated detail');
    await row.getByRole('button', { name: `Delete ${label}` }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(`${label} deleted.`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('No records', { exact: true })).toBeVisible();
  });
}

test('media: add, list and remove a reference', async ({ authenticatedPage: page }) => {
  await page.goto('/admin/media');
  await page.getByRole('button', { name: 'Add media' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Filename').fill('smoke.svg');
  await dialog.getByLabel('Image URL').fill('https://example.test/smoke.svg');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Delete smoke.svg' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No media yet')).toBeVisible();
});

test('messages: view, mark read, filter and delete', async ({ authenticatedPage: page, seededDb }) => {
  await seededDb.db.contactMessage.create({ data: {
    name: 'Smoke Sender', email: 'smoke@example.test', subject: 'Smoke inquiry', message: 'Synthetic message body',
  } });
  await page.goto('/admin/messages');
  const row = page.getByRole('row').filter({ hasText: 'Smoke inquiry' });
  await row.getByRole('button', { name: 'View message' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Synthetic message body');
  await dialog.getByRole('button', { name: 'Mark as read' }).click();
  await expect(row).toContainText(/read/i);
  await page.getByLabel('Filter messages').selectOption('READ');
  await row.getByRole('button', { name: 'Delete message' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No messages', { exact: true })).toBeVisible();
});
