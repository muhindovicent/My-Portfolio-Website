import { Router } from 'express.ts';
import { z } from 'zod.ts';
import { asyncHandler } from '../../middleware/error.ts.ts';
import { db } from '../../config/db.ts.ts';

const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email('Invalid email'),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

const router = Router();

router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const data = contactMessageSchema.parse(req.body);
    const message = await db.contactMessage.create({ data });
    res.status(201).json({ ok: true, data: { id: message.id } });
  })
);

export default router;


