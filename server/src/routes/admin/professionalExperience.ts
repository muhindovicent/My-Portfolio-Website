import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { professionalExperienceSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'professionalExperience',
    entityLabel: 'ProfessionalExperience',
    statusField: 'status',
    createSchema: professionalExperienceSchema,
    updateSchema: professionalExperienceSchema.partial(),
    defaultOrderBy: { sortOrder: 'asc', updatedAt: 'desc' },
  })
);

export default router;
