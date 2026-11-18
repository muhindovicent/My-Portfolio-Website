import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest.ts';

vi.mock('../../src/config/db', () => ({
  db: {
    loginAttempt: {
      count: vi.fn(),
      create: vi.fn(),
    },
    administrator: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    securityEvent: {
      create: vi.fn(),
    },
  },
}));

import { db } from '../../src/config/db.ts.ts';
import { bruteForceProtection, recordLoginAttempt } from './rateLimit.ts.ts';

const countMock = vi.mocked(db.loginAttempt.count);
const createMock = vi.mocked(db.loginAttempt.create);
const adminFindMock = vi.mocked(db.administrator.findUnique);
const adminUpdateMock = vi.mocked(db.administrator.update);
const securityEventCreateMock = vi.mocked(db.securityEvent.create);

describe('bruteForceProtection middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: { email: 'admin@example.com' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: vi.fn(() => undefined),
    };
    res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes when no recent failures', async () => {
    countMock.mockResolvedValue(0);

    await bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('locks account when max failures reached', async () => {
    countMock.mockResolvedValueOnce(5); // failures
    countMock.mockResolvedValueOnce(0); // successes
    adminFindMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: null,
      passwordHash: 'hash',
      role: 'ADMIN',
      isActive: true,
      emailVerified: false,
      mfaEnabled: false,
      mfaEnforced: false,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      lastMfaVerifiedAt: null,
      provisionedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await bruteForceProtection(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(429);
    expect(adminUpdateMock).toHaveBeenCalled();
    expect(securityEventCreateMock).toHaveBeenCalledWith({
      data: {
        adminId: 'admin-1',
        action: 'ACCOUNT_LOCKED',
        entity: 'Administrator',
        entityId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: null,
        metadata: { failures: 5, lockoutMinutes: 60 },
      },
    });
  });

  it('passes when there was a recent success (reset lockout)', async () => {
    countMock.mockResolvedValueOnce(5);
    countMock.mockResolvedValueOnce(1);

    await bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('passes when no email in body', async () => {
    req.body = {};
    countMock.mockResolvedValue(10);

    await bruteForceProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(countMock).not.toHaveBeenCalled();
  });
});

describe('recordLoginAttempt', () => {
  it('creates a login attempt record', async () => {
    createMock.mockResolvedValue({ id: 'attempt-1' } as any);

    await recordLoginAttempt({
      email: 'admin@example.com',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      success: true,
      adminId: 'admin-1',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.com',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        success: true,
      },
    });
    expect(adminUpdateMock).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date),
      },
    });
  });
});


