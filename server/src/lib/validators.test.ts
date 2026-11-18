import { describe, it, expect } from 'vitest.ts';
import {
  adminLoginSchema,
  mfaVerifySchema,
  backupCodeVerifySchema,
  recoveryRequestSchema,
  passwordResetSchema,
  provisionOwnerSchema,
  slugSchema,
} from './validators.ts.ts';

describe('validation schemas', () => {
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

  describe('mfaVerifySchema', () => {
    it('accepts 6-digit token', () => {
      expect(mfaVerifySchema.parse({ token: '123456' })).toEqual({ token: '123456' });
    });
    it('rejects wrong length', () => {
      expect(() => mfaVerifySchema.parse({ token: '12345' })).toThrow();
    });
  });

  describe('backupCodeVerifySchema', () => {
    it('accepts 8-char code', () => {
      expect(backupCodeVerifySchema.parse({ code: 'abcdef12' })).toEqual({ code: 'abcdef12' });
    });
  });

  describe('recoveryRequestSchema', () => {
    it('accepts valid email', () => {
      expect(recoveryRequestSchema.parse({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
    });
  });

  describe('passwordResetSchema', () => {
    it('accepts valid token and strong password', () => {
      expect(
        passwordResetSchema.parse({ token: 'abc123', password: 'StrongPass123!' })
      ).toEqual({ token: 'abc123', password: 'StrongPass123!' });
    });
    it('rejects weak password', () => {
      expect(() => passwordResetSchema.parse({ token: 'abc', password: 'weak' })).toThrow();
    });
  });

  describe('provisionOwnerSchema', () => {
    it('accepts valid provisioning data', () => {
      expect(
        provisionOwnerSchema.parse({
          email: 'owner@example.com',
          password: 'StrongPass123!',
          name: 'Owner',
        })
      ).toEqual({
        email: 'owner@example.com',
        password: 'StrongPass123!',
        name: 'Owner',
      });
    });
    it('rejects short password (min 12)', () => {
      expect(() =>
        provisionOwnerSchema.parse({ email: 'a@b.com', password: 'short' })
      ).toThrow();
    });
  });

  describe('slugSchema', () => {
    it('accepts valid slugs', () => {
      expect(slugSchema.parse('mafuta-watch')).toBe('mafuta-watch');
    });
    it('rejects invalid slugs', () => {
      expect(() => slugSchema.parse('Invalid_Slug')).toThrow();
    });
  });
});


