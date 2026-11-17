import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/error';
import { validate } from '../middleware/validate';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { paginationQuerySchema } from '../middleware/validate';
import { auditLog } from '../lib/audit';
import { db } from '../config/db';

interface CrudOptions {
  modelName: string;
  entityLabel: string;
  idParam?: 'id' | 'slug' | 'key';
  statusField?: string;
  createSchema: any;
  updateSchema: any;
  defaultOrderBy?: Record<string, 'asc' | 'desc'>;
  listFilter?: (query: Record<string, unknown>) => Record<string, unknown>;
}

export function createCrudRouter(options: CrudOptions): Router {
  const router = Router();
  const {
    modelName,
    entityLabel,
    idParam = 'id',
    statusField,
    createSchema,
    updateSchema,
    defaultOrderBy = { updatedAt: 'desc' },
    listFilter,
  } = options;
  const model: any = (db as any)[modelName];

  const buildWhere = (query: Record<string, unknown>): Record<string, unknown> => {
    const where: Record<string, unknown> = {};
    const status = query.status;
    if (status && statusField) {
      where[statusField] = status;
    }
    if (listFilter) {
      return { ...where, ...listFilter(query) };
    }
    return where;
  };

  // List
  router.get(
    '/',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req, res) => {
      const { page, limit, status } = req.query as unknown as {
        page: number;
        limit: number;
        status?: string;
      };
      const skip = (page - 1) * limit;
      const where = buildWhere({ page, limit, status });

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          skip,
          take: limit,
          orderBy: defaultOrderBy,
        }),
        model.count({ where }),
      ]);

      res.json({
        ok: true,
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    })
  );

  // Get by id/slug/key
  router.get(
    `/:${idParam}`,
    validate({ params: z.object({ [idParam]: z.string().min(1) }) }),
    asyncHandler(async (req, res) => {
      const where: Record<string, unknown> = { [idParam]: req.params[idParam] };
      const record = await model.findUnique({ where });
      if (!record) throw new AppError(`${entityLabel} not found`, 404);
      res.json({ ok: true, data: record });
    })
  );

  // Create
  router.post(
    '/',
    validate({ body: createSchema }),
    asyncHandler(async (req, res) => {
      const record = await model.create({ data: req.body });
      await auditLog({
        req: req as any,
        action: 'CREATE',
        entity: entityLabel,
        entityId: record.id,
        metadata: { ...req.body },
      });
      res.status(201).json({ ok: true, data: record });
    })
  );

  // Update
  router.patch(
    `/:${idParam}`,
    validate({ params: z.object({ [idParam]: z.string().min(1) }), body: updateSchema }),
    asyncHandler(async (req, res) => {
      const where: Record<string, unknown> = { [idParam]: req.params[idParam] };
      const existing = await model.findUnique({ where });
      if (!existing) throw new AppError(`${entityLabel} not found`, 404);

      const record = await model.update({ where, data: req.body });
      await auditLog({
        req: req as any,
        action: 'UPDATE',
        entity: entityLabel,
        entityId: record.id,
        metadata: { previous: existing, changes: req.body },
      });
      res.json({ ok: true, data: record });
    })
  );

  // Delete
  router.delete(
    `/:${idParam}`,
    validate({ params: z.object({ [idParam]: z.string().min(1) }) }),
    asyncHandler(async (req, res) => {
      const where: Record<string, unknown> = { [idParam]: req.params[idParam] };
      const existing = await model.findUnique({ where });
      if (!existing) throw new AppError(`${entityLabel} not found`, 404);

      await model.delete({ where });
      await auditLog({
        req: req as any,
        action: 'DELETE',
        entity: entityLabel,
        entityId: existing.id,
        metadata: { previous: existing },
      });
      res.json({ ok: true, data: { id: existing.id } });
    })
  );

  return router;
}
