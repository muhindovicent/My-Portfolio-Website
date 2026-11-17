import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/auth';
import { adminCreateSchema, adminUpdateSchema } from '../../lib/validators';
import { hashPassword } from '../../lib/password';
import { auditLog } from '../../lib/audit';
import { db } from '../../config/db';

const router = Router();

const adminSelectWithoutPassword = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  emailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

// List
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admins = await db.administrator.findMany({
      select: adminSelectWithoutPassword,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: admins });
  })
);

// Get by id
router.get(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const admin = await db.administrator.findUnique({
      where: { id: req.params.id },
      select: adminSelectWithoutPassword,
    });
    if (!admin) throw new AppError('Administrator not found', 404);
    res.json({ ok: true, data: admin });
  })
);

// Create
router.post(
  '/',
  requireAdmin,
  validate({ body: adminCreateSchema }),
  asyncHandler(async (req, res) => {
    const { email, password, name, role, isActive } = req.body;
    const existing = await db.administrator.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await hashPassword(password);
    const admin = await db.administrator.create({
      data: { email, passwordHash, name, role, isActive },
      select: adminSelectWithoutPassword,
    });

    await auditLog({
      req: req as any,
      action: 'CREATE',
      entity: 'Administrator',
      entityId: admin.id,
      metadata: { email },
    });

    res.status(201).json({ ok: true, data: admin });
  })
);

// Update
router.patch(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().min(1) }), body: adminUpdateSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password, ...rest } = req.body;
    const existing = await db.administrator.findUnique({ where: { id } });
    if (!existing) throw new AppError('Administrator not found', 404);

    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await hashPassword(password);
    }

    const admin = await db.administrator.update({
      where: { id },
      data,
      select: adminSelectWithoutPassword,
    });

    await auditLog({
      req: req as any,
      action: 'UPDATE',
      entity: 'Administrator',
      entityId: admin.id,
      metadata: { changes: rest },
    });

    res.json({ ok: true, data: admin });
  })
);

// Delete
router.delete(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await db.administrator.findUnique({ where: { id } });
    if (!existing) throw new AppError('Administrator not found', 404);

    await db.administrator.delete({ where: { id } });

    await auditLog({
      req: req as any,
      action: 'DELETE',
      entity: 'Administrator',
      entityId: id,
      metadata: { email: existing.email },
    });

    res.json({ ok: true, data: { id } });
  })
);

export default router;
