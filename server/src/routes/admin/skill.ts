import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { skillSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'skill',
    entityLabel: 'Skill',
    createSchema: skillSchema,
    updateSchema: skillSchema.partial(),
    defaultOrderBy: { category: 'asc', sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
