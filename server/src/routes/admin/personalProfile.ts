import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { personalProfileSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'personalProfile',
    entityLabel: 'PersonalProfile',
    createSchema: personalProfileSchema,
    updateSchema: personalProfileSchema.partial(),
    defaultOrderBy: { updatedAt: 'desc' },
  })
);

export default router;
