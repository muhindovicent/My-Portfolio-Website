import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../../middleware/error';
import { contactMessageCreateSchema } from '../../lib/validators';
import { db } from '../../config/db';

const router = Router();

const projectSelect = {
  slug: true,
  name: true,
  label: true,
  summary: true,
  detail: true,
  repoUrl: true,
  demoUrl: true,
  featured: true,
  sortOrder: true,
  mediaAsset: { select: { url: true, alt: true } },
} as const;

// Public contact message submission (no auth required)
router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const data = contactMessageCreateSchema.parse(req.body);
    const message = await db.contactMessage.create({ data });
    res.status(201).json({ ok: true, data: { id: message.id } });
  })
);

router.get(
  '/projects',
  asyncHandler(async (_req, res) => {
    const data = await db.project.findMany({
      where: { status: 'PUBLISHED' },
      select: projectSelect,
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const slug = z.string().min(1).max(120).parse(req.params.slug);
    const data = await db.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: projectSelect,
    });
    if (!data) throw new AppError('Project not found', 404);
    res.json({ ok: true, data });
  })
);

router.get(
  '/profile',
  asyncHandler(async (_req, res) => {
    const data = await db.personalProfile.findFirst({
      where: { isActive: true },
      select: {
        fullName: true,
        title: true,
        bio: true,
        location: true,
        email: true,
        phone: true,
        whatsapp: true,
        linkedin: true,
        github: true,
        avatar: { select: { url: true, alt: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/education',
  asyncHandler(async (_req, res) => {
    const data = await db.education.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        institution: true,
        degree: true,
        fieldOfStudy: true,
        startDate: true,
        endDate: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }, { institution: 'asc' }],
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/experience',
  asyncHandler(async (_req, res) => {
    const data = await db.professionalExperience.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        company: true,
        role: true,
        location: true,
        startDate: true,
        endDate: true,
        current: true,
        description: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }, { company: 'asc' }],
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/certifications',
  asyncHandler(async (_req, res) => {
    const data = await db.certification.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        title: true,
        issuer: true,
        date: true,
        description: true,
        sortOrder: true,
        mediaAsset: { select: { url: true, alt: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { date: 'desc' }, { title: 'asc' }],
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/skills',
  asyncHandler(async (_req, res) => {
    // Skills have no draft/archive status in this release; all skills are public.
    const data = await db.skill.findMany({
      select: { category: true, name: true, proficiency: true, sortOrder: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ ok: true, data });
  })
);

export default router;
