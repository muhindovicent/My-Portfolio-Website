import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { educationSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'education',
    entityLabel: 'Education',
    statusField: 'status',
    createSchema: educationSchema,
    updateSchema: educationSchema.partial(),
    defaultOrderBy: { sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
