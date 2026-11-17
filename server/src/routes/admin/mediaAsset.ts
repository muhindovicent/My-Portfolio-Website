import { Router } from 'express';
import { createCrudRouter } from '../../lib/crudFactory';
import { mediaAssetSchema } from '../../lib/validators';

const router = Router();

router.use(
  createCrudRouter({
    modelName: 'mediaAsset',
    entityLabel: 'MediaAsset',
    createSchema: mediaAssetSchema,
    updateSchema: mediaAssetSchema.partial(),
    defaultOrderBy: { createdAt: 'desc' },
  })
);

export default router;
