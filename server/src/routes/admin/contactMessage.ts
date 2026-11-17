import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { contactMessageCreateSchema, contactMessageUpdateSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'contactMessage',
    entityLabel: 'ContactMessage',
    statusField: 'status',
    createSchema: contactMessageCreateSchema,
    updateSchema: contactMessageUpdateSchema,
    defaultOrderBy: { createdAt: 'desc' },
  })
);

export default router;
