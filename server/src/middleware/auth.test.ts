import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest.ts';

vi.mock('../../src/config/db', () => ({
  db: {
    administrator: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { db } from '../../src/config/db.ts.ts';
import { requireAuth, requireMfa, type AuthenticatedRequest } from './auth.ts.ts';

const findUniqueMock = vi.mocked(db.administrator.findUnique);
const countMock = vi.mocked(db.administrator.count);

const mockAdmin = {
  id: 'admin-1',
  email: 'a@b.com',
  role: 'ADMIN',
  isActive: true,
  mfaEnabled: true,
  mfaEnforced: true,
  lockedUntil: null,
};

describe('requireAuth middleware (session-based)', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockReset();
    req = { session: {} };
    res = { json: vi.fn(), status: vi.fn().mockReturnThis(), clearCookie: vi.fn() };
    next = vi.fn();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no session adminId', () => {
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns 401 when administrator does not exist', async () => {
    req.session = { adminId: 'admin-1' };
    findUniqueMock.mockResolvedValue(null);

    await requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('returns 403 when administrator is inactive', async () => {
    req.session = { adminId: 'admin-1' };
    findUniqueMock.mockResolvedValue({ ...mockAdmin, isActive: false } as any);

    await requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('returns 403 when account is locked', async () => {
    req.session = { adminId: 'admin-1' };
    findUniqueMock.mockResolvedValue({
      ...mockAdmin,
      lockedUntil: new Date(Date.now() + 3600000),
    } as any);

    await requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('attaches admin to req for valid active administrator', async () => {
    req.session = { adminId: 'admin-1' };
    findUniqueMock.mockResolvedValue(mockAdmin as any);

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect((req as AuthenticatedRequest).admin).toEqual({
      id: 'admin-1',
      email: 'a@b.com',
      role: 'ADMIN',
      isActive: true,
      mfaEnabled: true,
      mfaEnforced: true,
    });
  });
});

describe('requireMfa middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { session: {}, admin: undefined };
    res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it('returns 401 when no admin', () => {
    requireMfa(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('returns 403 when MFA not verified', () => {
    req = {
      session: { mfaVerified: false },
      admin: { id: 'admin-1', email: 'a@b.com', role: 'ADMIN', isActive: true, mfaEnabled: true, mfaEnforced: true },
    };
    requireMfa(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('passes when MFA is verified', () => {
    req = {
      session: { mfaVerified: true },
      admin: { id: 'admin-1', email: 'a@b.com', role: 'ADMIN', isActive: true, mfaEnabled: true, mfaEnforced: true },
    };
    requireMfa(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});

describe('enforceSingleAdministrator', () => {
  it('rejects when admin exists', async () => {
    countMock.mockResolvedValue(1);
    const { enforceSingleAdministrator } = await import('./auth');
    await expect(enforceSingleAdministrator()).rejects.toThrow('Single-administrator architecture');
  });

  it('passes when no admin exists', async () => {
    countMock.mockResolvedValue(0);
    const { enforceSingleAdministrator } = await import('./auth');
    await expect(enforceSingleAdministrator()).resolves.toBeUndefined();
  });
});


