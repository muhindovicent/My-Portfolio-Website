import { Router } from 'express.ts';
import { requireAuth, requireMfa } from '../../middleware/auth.ts.ts';
import { csrfMiddleware } from '../../middleware/csrf.ts.ts';
import authRoutes from './auth.ts.ts';

const router = Router();

// Authentication routes handle their own CSRF/auth requirements internally.
router.use('/auth', authRoutes);

// All other admin routes require authentication + MFA verification.
router.use(requireAuth);
router.use(requireMfa);
router.use(csrfMiddleware);

export default router;


