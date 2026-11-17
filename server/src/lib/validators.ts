import { z } from 'zod';

export const ContentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const ContactStatusSchema = z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']);

// Common
export const uuidSchema = z.string().cuid('Invalid identifier format');
export const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric, hyphen-separated');
export const optionalString = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));
export const optionalUrl = z.string().url('Invalid URL').optional().or(z.literal('').transform(() => undefined));
export const optionalEmail = z.string().email('Invalid email').optional().or(z.literal('').transform(() => undefined));

// Administrator
export const adminCreateSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(50).default('ADMIN'),
  isActive: z.boolean().default(true),
});

export const adminUpdateSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// WebsiteSetting
export const websiteSettingUpsertSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.unknown(),
});

// PersonalProfile
export const personalProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  bio: optionalString,
  location: optionalString,
  email: optionalEmail,
  phone: optionalString,
  whatsapp: optionalString,
  linkedin: optionalUrl,
  github: optionalUrl,
  avatarImageId: z.string().cuid().optional(),
  isActive: z.boolean().default(true),
});

// Project
export const projectSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(200),
  label: optionalString,
  summary: optionalString,
  detail: optionalString,
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  status: ContentStatusSchema.default('DRAFT'),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  mediaAssetId: z.string().cuid().optional(),
});

// Education
export const educationSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  degree: z.string().trim().min(1).max(200),
  fieldOfStudy: optionalString,
  startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  status: ContentStatusSchema.default('DRAFT'),
  sortOrder: z.number().int().min(0).default(0),
});

// ProfessionalExperience
export const professionalExperienceSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  location: optionalString,
  startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  current: z.boolean().default(false),
  description: optionalString,
  status: ContentStatusSchema.default('DRAFT'),
  sortOrder: z.number().int().min(0).default(0),
});

// LeadershipPosition
export const leadershipPositionSchema = z.object({
  organization: z.string().trim().min(1).max(200),
  position: z.string().trim().min(1).max(200),
  startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  description: optionalString,
  status: ContentStatusSchema.default('DRAFT'),
  sortOrder: z.number().int().min(0).default(0),
});

// Certification
export const certificationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  issuer: z.string().trim().min(1).max(200),
  date: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  description: optionalString,
  imageId: z.string().cuid().optional(),
  status: ContentStatusSchema.default('DRAFT'),
  sortOrder: z.number().int().min(0).default(0),
});

// Skill
export const skillSchema = z.object({
  category: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  proficiency: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

// MediaAsset
export const mediaAssetSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  originalName: optionalString,
  mimeType: optionalString,
  size: z.number().int().nonnegative().optional(),
  url: z.string().url('Invalid URL'),
  alt: optionalString,
  uploadedBy: optionalString,
});

// ContactMessage
export const contactMessageCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email('Invalid email'),
  subject: optionalString,
  message: z.string().trim().min(1).max(5000),
});

export const contactMessageUpdateSchema = z.object({
  status: ContactStatusSchema,
});

// Query
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});
