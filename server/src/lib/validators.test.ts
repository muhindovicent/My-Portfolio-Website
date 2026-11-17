import { describe, it, expect } from 'vitest';
import {
  projectSchema,
  adminLoginSchema,
  contactMessageCreateSchema,
  skillSchema,
  slugSchema,
  websiteSettingUpsertSchema,
} from './validators';

describe('validation schemas', () => {
  describe('slugSchema', () => {
    it('accepts valid slugs', () => {
      expect(slugSchema.parse('mafuta-watch')).toBe('mafuta-watch');
      expect(slugSchema.parse('tunza')).toBe('tunza');
    });
    it('rejects invalid slugs', () => {
      expect(() => slugSchema.parse('Invalid_Slug')).toThrow();
      expect(() => slugSchema.parse('has spaces')).toThrow();
    });
  });

  describe('projectSchema', () => {
    it('accepts a valid project', () => {
      const data = projectSchema.parse({
        slug: 'my-project',
        name: 'My Project',
        status: 'DRAFT',
      });
      expect(data.slug).toBe('my-project');
      expect(data.status).toBe('DRAFT');
    });
    it('defaults status to DRAFT', () => {
      const data = projectSchema.parse({ slug: 'x', name: 'X' });
      expect(data.status).toBe('DRAFT');
    });
    it('rejects missing required fields', () => {
      expect(() => projectSchema.parse({ slug: 'x' })).toThrow();
    });
  });

  describe('adminLoginSchema', () => {
    it('accepts valid credentials', () => {
      expect(adminLoginSchema.parse({ email: 'a@b.com', password: 'pass123' })).toEqual({
        email: 'a@b.com',
        password: 'pass123',
      });
    });
    it('rejects invalid email', () => {
      expect(() => adminLoginSchema.parse({ email: 'not-email', password: 'pass123' })).toThrow();
    });
  });

  describe('contactMessageCreateSchema', () => {
    it('accepts valid message', () => {
      expect(
        contactMessageCreateSchema.parse({
          name: 'Jane Doe',
          email: 'jane@example.com',
          message: 'Hello',
        })
      ).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', message: 'Hello' });
    });
    it('rejects too-long message', () => {
      expect(() =>
        contactMessageCreateSchema.parse({ name: 'A', email: 'a@b.com', message: 'x'.repeat(5001) })
      ).toThrow();
    });
  });

  describe('skillSchema', () => {
    it('accepts valid skill', () => {
      expect(skillSchema.parse({ category: 'Frontend', name: 'React', sortOrder: 0 })).toMatchObject({
        category: 'Frontend',
        name: 'React',
        sortOrder: 0,
      });
    });
  });

  describe('websiteSettingUpsertSchema', () => {
    it('accepts key + value', () => {
      expect(
        websiteSettingUpsertSchema.parse({ key: 'nav', value: [{ label: 'Work', url: '/work/' }] })
      ).toMatchObject({ key: 'nav' });
    });
  });
});
