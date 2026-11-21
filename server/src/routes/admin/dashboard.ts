import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { db } from '../../config/db';

const router = Router();

router.use(requireAdmin);

const statusCount = (model: any, status: string) => model.count({ where: { status } });

// Dashboard: every figure is read from the database. No placeholders.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [
      projectsTotal,
      projectsPublished,
      projectsDraft,
      projectsArchived,
      projectsFeatured,
      educationTotal,
      educationPublished,
      experienceTotal,
      leadershipTotal,
      certificationsTotal,
      skillsTotal,
      skillCategories,
      mediaTotal,
      messagesTotal,
      messagesNew,
      profile,
      activity,
      security,
    ] = await Promise.all([
      db.project.count(),
      statusCount(db.project, 'PUBLISHED'),
      statusCount(db.project, 'DRAFT'),
      statusCount(db.project, 'ARCHIVED'),
      db.project.count({ where: { featured: true } }),
      db.education.count(),
      statusCount(db.education, 'PUBLISHED'),
      db.professionalExperience.count(),
      db.leadershipPosition.count(),
      db.certification.count(),
      db.skill.count(),
      db.skill.findMany({ select: { category: true }, distinct: ['category'] }).then((rows: any[]) => rows.length),
      db.mediaAsset.count(),
      db.contactMessage.count(),
      db.contactMessage.count({ where: { status: 'NEW' } }),
      db.personalProfile.findFirst({ orderBy: { updatedAt: 'desc' }, select: { id: true, fullName: true, title: true } }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { admin: { select: { id: true, email: true, name: true } } },
      }),
      db.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

    res.json({
      ok: true,
      data: {
        stats: {
          projects: { total: projectsTotal, published: projectsPublished, draft: projectsDraft, archived: projectsArchived, featured: projectsFeatured },
          education: { total: educationTotal, published: educationPublished },
          experience: { total: experienceTotal },
          leadership: { total: leadershipTotal },
          certifications: { total: certificationsTotal },
          skills: { total: skillsTotal, categories: skillCategories },
          media: { total: mediaTotal },
          messages: { total: messagesTotal, unread: messagesNew },
        },
        profile,
        activity,
        security,
      },
    });
  })
);

// Notifications: unread messages plus recent security events.
router.get(
  '/notifications',
  asyncHandler(async (_req, res) => {
    const [unread, messages, security] = await Promise.all([
      db.contactMessage.count({ where: { status: 'NEW' } }),
      db.contactMessage.findMany({
        where: { status: 'NEW' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, subject: true, createdAt: true },
      }),
      db.securityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, action: true, createdAt: true },
      }),
    ]);
    res.json({ ok: true, data: { unread, messages, security } });
  })
);

// Global search across content collections.
router.get(
  '/search',
  validate({ query: z.object({ q: z.string().trim().min(1).max(120) }) }),
  asyncHandler(async (req, res) => {
    const q = (req.query as unknown as { q: string }).q;
    const contains = { contains: q, mode: 'insensitive' as const };
    const [projects, education, experience, leadership, certifications, skills, messages] = await Promise.all([
      db.project.findMany({ where: { OR: [{ name: contains }, { slug: contains }] }, take: 10, select: { id: true, name: true, slug: true, status: true } }),
      db.education.findMany({ where: { OR: [{ institution: contains }, { degree: contains }] }, take: 10, select: { id: true, institution: true, degree: true } }),
      db.professionalExperience.findMany({ where: { OR: [{ company: contains }, { role: contains }] }, take: 10, select: { id: true, company: true, role: true } }),
      db.leadershipPosition.findMany({ where: { OR: [{ organization: contains }, { position: contains }] }, take: 10, select: { id: true, organization: true, position: true } }),
      db.certification.findMany({ where: { OR: [{ title: contains }, { issuer: contains }] }, take: 10, select: { id: true, title: true, issuer: true } }),
      db.skill.findMany({ where: { OR: [{ name: contains }, { category: contains }] }, take: 10, select: { id: true, name: true, category: true } }),
      db.contactMessage.findMany({ where: { OR: [{ name: contains }, { subject: contains }] }, take: 10, select: { id: true, name: true, subject: true, status: true } }),
    ]);
    res.json({
      ok: true,
      data: {
        projects,
        education,
        experience,
        leadership,
        certifications,
        skills,
        messages,
        total: projects.length + education.length + experience.length + leadership.length + certifications.length + skills.length + messages.length,
      },
    });
  })
);

export default router;
