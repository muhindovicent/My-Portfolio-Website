import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { leadershipPositionSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'leadershipPosition',
    entityLabel: 'LeadershipPosition',
    statusField: 'status',
    createSchema: leadershipPositionSchema,
    updateSchema: leadershipPositionSchema.partial(),
    defaultOrderBy: { sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
