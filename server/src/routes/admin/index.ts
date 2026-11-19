import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { csrfMiddleware } from '../../lib/csrf';
import authRoutes from './auth';
import projectRoutes from './projects';
import educationRoutes from './education';
import professionalExperienceRoutes from './professionalExperience';
import leadershipPositionRoutes from './leadershipPosition';
import certificationRoutes from './certification';
import skillRoutes from './skill';
import mediaAssetRoutes from './mediaAsset';
import contactMessageRoutes from './contactMessage';
import websiteSettingRoutes from './websiteSetting';
import personalProfileRoutes from './personalProfile';
import auditLogRoutes from './auditLog';
import dashboardRoutes from './dashboard';

const router = Router();

// Authentication routes (login/logout/setup/mfa/recovery) handle CSRF internally.
router.use('/auth', authRoutes);

// All other admin routes require a valid, active administrator session.
router.use(requireAdmin);

// CSRF protection for all state-changing admin routes (POST/PUT/PATCH/DELETE).
router.use(csrfMiddleware);

router.use('/projects', projectRoutes);
router.use('/education', educationRoutes);
router.use('/experience', professionalExperienceRoutes);
router.use('/leadership', leadershipPositionRoutes);
router.use('/certifications', certificationRoutes);
router.use('/skills', skillRoutes);
router.use('/media', mediaAssetRoutes);
router.use('/contact-messages', contactMessageRoutes);
router.use('/settings', websiteSettingRoutes);
router.use('/profile', personalProfileRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
