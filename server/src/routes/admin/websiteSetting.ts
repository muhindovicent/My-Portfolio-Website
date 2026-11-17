import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/auth';
import { websiteSettingUpsertSchema } from '../../lib/validators';
import { paginationQuerySchema } from '../../middleware/validate';
import { auditLog } from '../../lib/audit';
import { db } from '../../config/db';
import type { Prisma } from '@prisma/client';

const router = Router();

const settingSelect = { id: true, key: true, value: true, updatedBy: true, updatedAt: true, createdAt: true };

// List
router.get(
  '/',
  requireAdmin,
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      db.websiteSetting.findMany({ skip, take: limit, orderBy: { key: 'asc' }, select: settingSelect }),
      db.websiteSetting.count(),
    ]);
    res.json({ ok: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// Get by key
router.get(
  '/:key',
  requireAdmin,
  validate({ params: z.object({ key: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const setting = await db.websiteSetting.findUnique({
      where: { key: req.params.key },
      select: settingSelect,
    });
    if (!setting) throw new AppError('Setting not found', 404);
    res.json({ ok: true, data: setting });
  })
);

// Upsert (create or update)
router.post(
  '/',
  requireAdmin,
  validate({ body: websiteSettingUpsertSchema }),
  asyncHandler(async (req, res) => {
    const { key, value } = req.body as { key: string; value: Prisma.InputJsonValue };
    const setting = await db.websiteSetting.upsert({
      where: { key },
      update: { value, updatedBy: (req as any).admin!.id },
      create: { key, value, updatedBy: (req as any).admin!.id },
      select: settingSelect,
    });

    await auditLog({
      req: req as any,
      action: 'UPSERT',
      entity: 'WebsiteSetting',
      entityId: setting.id,
      metadata: { key } as Prisma.InputJsonValue,
    });

    res.status(201).json({ ok: true, data: setting });
  })
);

// Update by key
router.patch(
  '/:key',
  requireAdmin,
  validate({ params: z.object({ key: z.string().min(1) }), body: websiteSettingUpsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await db.websiteSetting.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new AppError('Setting not found', 404);

    const { key, ...rest } = req.body as { key?: string; value?: Prisma.InputJsonValue };
    const data: Record<string, unknown> = { updatedBy: (req as any).admin!.id };
    if (rest.value !== undefined) data.value = rest.value;
    const setting = await db.websiteSetting.update({
      where: { key: req.params.key },
      data: data as Prisma.WebsiteSettingUpdateInput,
      select: settingSelect,
    });

    await auditLog({
      req: req as any,
      action: 'UPDATE',
      entity: 'WebsiteSetting',
      entityId: setting.id,
      metadata: { key: req.params.key, changes: rest } as Prisma.InputJsonValue,
    });

    res.json({ ok: true, data: setting });
  })
);

// Delete by key
router.delete(
  '/:key',
  requireAdmin,
  validate({ params: z.object({ key: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const existing = await db.websiteSetting.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new AppError('Setting not found', 404);

    await db.websiteSetting.delete({ where: { key: req.params.key } });

    await auditLog({
      req: req as any,
      action: 'DELETE',
      entity: 'WebsiteSetting',
      entityId: existing.id,
      metadata: { key: req.params.key },
    });

    res.json({ ok: true, data: { key: req.params.key } });
  })
);

export default router;
