import { z } from 'zod.ts';

export const ContentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

// Common
export const uuidSchema = z.string().cuid('Invalid identifier format');
export const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric, hyphen-separated');
export const optionalString = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));
export const optionalUrl = z.string().url('Invalid URL').optional().or(z.literal('').transform(() => undefined));
export const optionalEmail = z.string().email('Invalid email').optional().or(z.literal('').transform(() => undefined));

// Administrator login
export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// MFA verification
export const mfaVerifySchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

// Backup code verification
export const backupCodeVerifySchema = z.object({
  code: z.string().length(8, 'Backup code must be 8 characters'),
});

// Password recovery request
export const recoveryRequestSchema = z.object({
  email: z.string().email('Invalid email'),
});

// Password recovery verify
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// One-time owner provisioning
export const provisionOwnerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  name: z.string().trim().min(1).max(120).optional(),
});

// Query
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

