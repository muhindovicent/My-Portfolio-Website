import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error';
import { contactMessageCreateSchema } from '../../lib/validators';
import { db } from '../../config/db';

const router = Router();

// Public contact message submission (no auth required)
router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const data = contactMessageCreateSchema.parse(req.body);
    const message = await db.contactMessage.create({ data });
    res.status(201).json({ ok: true, data: { id: message.id } });
  })
);

export default router;
