import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/auth';
import { paginationQuerySchema } from '../../middleware/validate';
import { db } from '../../config/db';

const router = Router();

// List audit logs (read-only)
router.get(
  '/',
  requireAdmin,
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, email: true, name: true } } },
      }),
      db.auditLog.count(),
    ]);
    res.json({ ok: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// Get audit log by id
router.get(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const log = await db.auditLog.findUnique({
      where: { id: req.params.id },
      include: { admin: { select: { id: true, email: true, name: true } } },
    });
    if (!log) throw new AppError('Audit log entry not found', 404);
    res.json({ ok: true, data: log });
  })
);

export default router;
