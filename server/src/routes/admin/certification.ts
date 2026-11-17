import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { certificationSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'certification',
    entityLabel: 'Certification',
    statusField: 'status',
    createSchema: certificationSchema,
    updateSchema: certificationSchema.partial(),
    defaultOrderBy: { sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
