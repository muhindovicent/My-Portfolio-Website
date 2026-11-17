import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { projectSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'project',
    entityLabel: 'Project',
    idParam: 'slug',
    statusField: 'status',
    createSchema: projectSchema,
    updateSchema: projectSchema.partial(),
    defaultOrderBy: { sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
