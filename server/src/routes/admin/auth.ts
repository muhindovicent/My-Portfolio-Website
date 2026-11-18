import crypto from 'crypto.ts';
import { Router } from 'express.ts';
import { z } from 'zod.ts';
import { asyncHandler, AppError } from '../../middleware/error.ts.ts';
import { validate } from '../../middleware/validate.ts.ts';
import { requireAuth, requireMfa, enforceSingleAdministrator, AuthenticatedRequest } from '../../middleware/auth.ts.ts';
import {
  loginRateLimiter,
  mfaRateLimiter,
  recoveryRateLimiter,
  bruteForceProtection,
  recordLoginAttempt,
  getClientIp,
  getUserAgent,
} from '../../middleware/rateLimit.ts.ts';
import { csrfMiddleware, generateCsrfToken } from '../../middleware/csrf.ts.ts';
import { logSecurityEvent } from '../../lib/securityEvent.ts.ts';
import {
  generateMfaSecret,
  generateMfaQrCode,
  verifyMfaToken,
  generateBackupCodes,
} from '../../lib/mfa.ts.ts';
import { encrypt, decrypt } from '../../lib/encryption.ts.ts';
import { hashPassword, comparePassword } from '../../lib/password.ts.ts';
import { db } from '../../config/db.ts.ts';

const router = Router();

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const mfaVerifySchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

const backupCodeVerifySchema = z.object({
  code: z.string().length(8, 'Backup code must be 8 characters'),
});

const recoveryRequestSchema = z.object({
  email: z.string().email('Invalid email'),
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

// ---------------------------------------------------------------------------
// CSRF token (public, no auth required)
// ---------------------------------------------------------------------------
router.get(
  '/csrf-token',
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    let token = session?.csrfToken;
    if (!token) {
      token = generateCsrfToken();
      session.csrfToken = token;
    }
    res.json({ ok: true, csrfToken: token });
  })
);

// ---------------------------------------------------------------------------
// Login (rate limited, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/login',
  loginRateLimiter,
  bruteForceProtection,
  csrfMiddleware,
  validate({ body: adminLoginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const admin = await db.administrator.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mfaEnforced: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });

    if (!admin || !(await comparePassword(password, admin.passwordHash))) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false });
      await logSecurityEvent({
        adminId: null,
        action: 'LOGIN_FAILED',
        entity: 'Administrator',
        entityId: email,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (!admin.isActive) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false });
      await logSecurityEvent({
        adminId: admin.id,
        action: 'LOGIN_FAILED',
        entity: 'Administrator',
        entityId: admin.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'account_inactive' },
      });
      throw new AppError('Administrator account is inactive', 403);
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false });
      throw new AppError('Account is temporarily locked', 423);
    }

    await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: true, adminId: admin.id });

    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve, reject) => {
      (req.session as any).regenerate((err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const session = req.session as any;
    session.adminId = admin.id;
    session.mfaVerified = false;
    session.csrfToken = generateCsrfToken();

    await logSecurityEvent({
      adminId: admin.id,
      action: 'LOGIN',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: ip,
      userAgent,
      metadata: { mfaEnabled: admin.mfaEnabled, mfaEnforced: admin.mfaEnforced },
    });

    // If MFA is enabled/enforced, require MFA verification before full access
    if (admin.mfaEnabled || admin.mfaEnforced) {
      res.status(202).json({
        ok: true,
        mfaRequired: true,
        message: 'MFA verification required',
        csrfToken: session.csrfToken,
      });
      return;
    }

    session.mfaVerified = true;

    res.json({
      ok: true,
      mfaRequired: false,
      admin: { id: admin.id, email: admin.email, role: admin.role },
      csrfToken: session.csrfToken,
    });
  })
);

// ---------------------------------------------------------------------------
// MFA verify during login (rate limited, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/login/mfa',
  mfaRateLimiter,
  csrfMiddleware,
  validate({ body: mfaVerifySchema }),
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    const adminId = session?.adminId;
    const token = req.body.token;

    if (!adminId) {
      throw new AppError('Authentication session not found', 401);
    }
    if (session?.mfaVerified) {
      throw new AppError('MFA already verified', 400);
    }

    const admin = await db.administrator.findUnique({
      where: { id: adminId },
      include: { mfaSecret: true },
    });
    if (!admin || !admin.isActive) {
      throw new AppError('Administrator not found', 404);
    }
    if (!admin.mfaSecret?.enabled) {
      throw new AppError('MFA is not enabled for this account', 400);
    }

    const decryptedSecret = decrypt(admin.mfaSecret.encryptedSecret);
    const valid = verifyMfaToken(decryptedSecret, token);
    if (!valid) {
      await logSecurityEvent({
        adminId: admin.id,
        action: 'MFA_VERIFY',
        entity: 'Administrator',
        entityId: admin.id,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        metadata: { result: 'invalid_token' },
      });
      throw new AppError('Invalid MFA token', 401);
    }

    session.mfaVerified = true;
    await db.administrator.update({
      where: { id: admin.id },
      data: { lastMfaVerifiedAt: new Date() },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_VERIFY',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { result: 'success' },
    });

    res.json({
      ok: true,
      admin: { id: admin.id, email: admin.email, role: admin.role },
      csrfToken: session.csrfToken,
    });
  })
);

// ---------------------------------------------------------------------------
// Backup code verify during login (rate limited, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/login/backup-code',
  mfaRateLimiter,
  csrfMiddleware,
  validate({ body: backupCodeVerifySchema }),
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    const adminId = session?.adminId;
    const code = req.body.code;

    if (!adminId) {
      throw new AppError('Authentication session not found', 401);
    }
    if (session?.mfaVerified) {
      throw new AppError('MFA already verified', 400);
    }

    const admin = await db.administrator.findUnique({
      where: { id: adminId },
      include: { backupCodes: true },
    });
    if (!admin || !admin.isActive) {
      throw new AppError('Administrator not found', 404);
    }

    // Find an unused backup code matching the hash
    const matchingCode = await db.backupCode.findFirst({
      where: {
        adminId: admin.id,
        used: false,
      },
    });

    if (!matchingCode) {
      throw new AppError('No backup codes available', 400);
    }

    const valid = await comparePassword(code, matchingCode.codeHash);
    if (!valid) {
      await logSecurityEvent({
        adminId: admin.id,
        action: 'MFA_VERIFY',
        entity: 'Administrator',
        entityId: admin.id,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        metadata: { result: 'invalid_backup_code' },
      });
      throw new AppError('Invalid backup code', 401);
    }

    // Mark backup code as used (single-use)
    await db.backupCode.update({
      where: { id: matchingCode.id },
      data: { used: true, usedAt: new Date() },
    });

    session.mfaVerified = true;
    await db.administrator.update({
      where: { id: admin.id },
      data: { lastMfaVerifiedAt: new Date() },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_VERIFY',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { result: 'backup_code_success' },
    });

    res.json({
      ok: true,
      admin: { id: admin.id, email: admin.email, role: admin.role },
      csrfToken: session.csrfToken,
    });
  })
);

// ---------------------------------------------------------------------------
// MFA setup (requires auth, CSRF protected)
// Returns secret + QR code + backup codes ONCE
// ---------------------------------------------------------------------------
router.post(
  '/mfa/setup',
  requireAuth,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const admin = await db.administrator.findUnique({
      where: { id: authenticatedReq.admin!.id },
      include: { mfaSecret: true },
    });
    if (!admin) throw new AppError('Administrator not found', 404);

    let mfaSecret = admin.mfaSecret;
    if (!mfaSecret) {
      const secret = generateMfaSecret();
      mfaSecret = await db.mfaSecret.create({
        data: { adminId: admin.id, encryptedSecret: encrypt(secret), enabled: false },
      });
    }

    const decryptedSecret = decrypt(mfaSecret.encryptedSecret);
    const qrCode = await generateMfaQrCode(decryptedSecret, admin.email);
    const backupCodes = generateBackupCodes(8);
    const backupCodeHashes = await Promise.all(backupCodes.map((code) => hashPassword(code)));

    await db.backupCode.createMany({
      data: backupCodeHashes.map((hash: string) => ({
        adminId: admin.id,
        codeHash: hash,
      })),
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_SETUP',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { backupCodesCount: backupCodes.length },
    });

    // Return secret and backup codes ONLY once
    res.json({
      ok: true,
      secret: decryptedSecret,
      qrCode,
      backupCodes, // Store these securely - shown only once
      enabled: mfaSecret.enabled,
    });
  })
);

// ---------------------------------------------------------------------------
// Verify and enable MFA (requires auth + MFA verified, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/mfa/verify-setup',
  requireAuth,
  requireMfa,
  csrfMiddleware,
  validate({ body: mfaVerifySchema }),
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const token = req.body.token;

    const admin = await db.administrator.findUnique({
      where: { id: authenticatedReq.admin!.id },
      include: { mfaSecret: true },
    });
    if (!admin || !admin.mfaSecret) {
      throw new AppError('MFA not set up', 400);
    }

    const decryptedSecret = decrypt(admin.mfaSecret.encryptedSecret);
    const valid = verifyMfaToken(decryptedSecret, token);
    if (!valid) {
      throw new AppError('Invalid MFA token', 401);
    }

    await db.mfaSecret.update({
      where: { id: admin.mfaSecret.id },
      data: { enabled: true },
    });
    await db.administrator.update({
      where: { id: admin.id },
      data: { mfaEnabled: true, mfaEnforced: true },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_VERIFY',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { result: 'mfa_enabled' },
    });

    res.json({ ok: true, mfaEnabled: true });
  })
);

// ---------------------------------------------------------------------------
// Disable MFA (requires auth + MFA verified, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/mfa/disable',
  requireAuth,
  requireMfa,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;

    await db.mfaSecret.deleteMany({
      where: { adminId: authenticatedReq.admin!.id },
    });
    await db.backupCode.deleteMany({
      where: { adminId: authenticatedReq.admin!.id },
    });
    await db.administrator.update({
      where: { id: authenticatedReq.admin!.id },
      data: { mfaEnabled: false, mfaEnforced: false },
    });

    await logSecurityEvent({
      adminId: authenticatedReq.admin!.id,
      action: 'MFA_DISABLE',
      entity: 'Administrator',
      entityId: authenticatedReq.admin!.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    res.json({ ok: true, mfaEnabled: false });
  })
);

// ---------------------------------------------------------------------------
// Logout (requires auth, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/logout',
  requireAuth,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const adminId = authenticatedReq.admin!.id;
    const sid = req.sessionID;

    // Revoke the session from the database
    if (sid) {
      await db.session.delete({ where: { sid } }).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      (req.session as any).destroy((err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    await logSecurityEvent({
      adminId,
      action: 'LOGOUT',
      entity: 'Administrator',
      entityId: adminId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { sessionId: sid },
    });

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Revoke all sessions (requires auth + MFA, CSRF protected)
// ---------------------------------------------------------------------------
router.post(
  '/sessions/revoke',
  requireAuth,
  requireMfa,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const adminId = authenticatedReq.admin!.id;
    const currentSid = req.sessionID;

    await db.session.deleteMany({
      where: { adminId, sid: { not: currentSid } },
    });

    await logSecurityEvent({
      adminId,
      action: 'SESSION_REVOKED',
      entity: 'Administrator',
      entityId: adminId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Password recovery request (rate limited, CSRF protected)
// Always returns success to prevent email enumeration.
// Recovery token is NOT returned - it must be delivered out-of-band (email).
// ---------------------------------------------------------------------------
router.post(
  '/recovery',
  recoveryRateLimiter,
  bruteForceProtection,
  csrfMiddleware,
  validate({ body: recoveryRequestSchema }),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const admin = await db.administrator.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!admin) {
      res.json({ ok: true, message: 'If the account exists, a recovery token has been generated.' });
      return;
    }

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await hashPassword(token);

    await db.passwordResetToken.create({
      data: {
        adminId: admin.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'RECOVERY_REQUEST',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    // Token is NOT returned - it must be delivered out-of-band
    res.json({
      ok: true,
      message: 'If the account exists, a recovery token has been generated. Check your email.',
    });
  })
);

// ---------------------------------------------------------------------------
// Password recovery verify (rate limited, CSRF protected)
// Verifies reset token and resets password.
// ---------------------------------------------------------------------------
router.post(
  '/recovery/verify',
  recoveryRateLimiter,
  csrfMiddleware,
  validate({ body: passwordResetSchema }),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { admin: true },
    });

    if (!resetToken) {
      throw new AppError('Invalid or expired recovery token', 400);
    }

    const valid = await comparePassword(token, resetToken.tokenHash);
    if (!valid) {
      throw new AppError('Invalid or expired recovery token', 400);
    }

    const newHash = await hashPassword(password);

    await db.$transaction([
      db.administrator.update({
        where: { id: resetToken.adminId },
        data: { passwordHash: newHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true, usedAt: new Date() },
      }),
    ]);

    await logSecurityEvent({
      adminId: resetToken.adminId,
      action: 'PASSWORD_RESET_COMPLETE',
      entity: 'Administrator',
      entityId: resetToken.adminId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    res.json({ ok: true, message: 'Password reset successful.' });
  })
);

// ---------------------------------------------------------------------------
// Get current admin (requires auth + MFA)
// ---------------------------------------------------------------------------
router.get(
  '/me',
  requireAuth,
  requireMfa,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const admin = await db.administrator.findUnique({
      where: { id: authenticatedReq.admin!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mfaEnforced: true,
        lastLoginAt: true,
        lastMfaVerifiedAt: true,
        createdAt: true,
      },
    });
    if (!admin) throw new AppError('Administrator not found', 404);
    res.json({ ok: true, admin });
  })
);

export default router;


