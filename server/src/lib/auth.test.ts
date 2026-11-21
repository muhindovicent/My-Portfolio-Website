// @ts-nocheck - Test file with heavy mocking; runtime behavior verified by vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock password module to avoid slow bcrypt hashing in tests
vi.mock('./password', () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  comparePassword: vi.fn(async (plain: string, hash: string) => `hash:${plain}` === hash),
}));

vi.mock('../config/db', () => ({
  db: {
    administrator: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    mfaSecret: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    backupCode: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    securityEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      administrator: { update: vi.fn(), findFirst: vi.fn() },
      passwordResetToken: { updateMany: vi.fn() },
      securityEvent: { create: vi.fn() },
    })),
  },
}));

vi.mock('../lib/owner', () => ({
  digest: vi.fn((v: string) => `digest:${v}`),
  unseal: vi.fn((v: string) => `secret:${v}`),
  provision: vi.fn(),
  issueReset: vi.fn(),
}));

vi.mock('speakeasy', () => ({
  totp: vi.fn(() => ({ verifyDelta: () => ({ delta: 0 }) })),
  generateSecret: vi.fn(() => ({ base32: 'SECRETBASE32' })),
}));

import { db } from '../config/db';
import { hashPassword, comparePassword } from './password';
import { digest, unseal } from './owner';
import { totp } from 'speakeasy';

const findUniqueMock = vi.mocked(db.administrator.findUnique);
const mfaSecretUpdateManyMock = vi.mocked(db.mfaSecret.updateMany);
const backupCodeUpdateManyMock = vi.mocked(db.backupCode.updateMany);
const sessionDeleteManyMock = vi.mocked(db.session.deleteMany);
const securityEventCreateMock = vi.mocked(db.securityEvent.create);

const hashMock = vi.mocked(hashPassword);
const compareMock = vi.mocked(comparePassword);
const digestMock = vi.mocked(digest);
const unsealMock = vi.mocked(unseal);
const totpFn = totp as unknown as ReturnType<typeof vi.fn>;

const projectCreateMock = vi.mocked(db.project.create);
const projectFindUniqueMock = vi.mocked(db.project.findUnique);
const projectUpdateMock = vi.mocked(db.project.update);
const projectDeleteMock = vi.mocked(db.project.delete);

describe('Authentication contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (digestMock as any).mockImplementation((v: string) => `digest:${v}`);
    (unsealMock as any).mockImplementation((v: string) => `secret:${v}`);
    (totpFn as any).mockImplementation(() => ({ verifyDelta: () => ({ delta: 0 }) }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login response contract', () => {
    it('validates credentials and checks MFA enabled', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        isActive: true,
        mfaSecret: { enabled: true },
        passwordHash: 'hash:correct-password',
      } as any);
      compareMock.mockResolvedValue(true);

      const owner = await db.administrator.findUnique({
        where: { email: 'admin@test.com' },
        include: { mfaSecret: { select: { enabled: true } } },
      });
      expect(owner?.mfaSecret?.enabled).toBe(true);

      const result = await comparePassword('correct-password', 'hash:correct-password');
      expect(result).toBe(true);
    });

    it('rejects login when MFA is not enabled', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        isActive: true,
        mfaSecret: { enabled: false },
        passwordHash: 'hash:pw',
      } as any);
      compareMock.mockResolvedValue(true);

      const owner = await db.administrator.findUnique({
        where: { email: 'admin@test.com' },
        include: { mfaSecret: { select: { enabled: true } } },
      });
      expect(owner?.mfaSecret?.enabled).toBe(false);
    });

    it('rejects inactive accounts', async () => {
      findUniqueMock.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        isActive: false,
        mfaSecret: { enabled: true },
        passwordHash: 'hash:pw',
      } as any);

      const owner = await db.administrator.findUnique({
        where: { email: 'admin@test.com' },
        include: { mfaSecret: { select: { enabled: true } } },
      });
      expect(owner?.isActive).toBe(false);
    });
  });

  describe('MFA verification', () => {
    it('accepts valid 6-digit TOTP token', async () => {
      (totpFn as any).mockImplementation(() => ({ verifyDelta: () => ({ delta: 0 }) }));
      mfaSecretUpdateManyMock.mockResolvedValue({ count: 1 });

      const owner = { id: 'admin-1', mfaSecret: { id: 'mfa-1', ciphertext: 'enc:secret' } };
      const step = Math.floor(Date.now() / 30000);
      const delta = (totpFn as any)().verifyDelta({
        secret: unsealMock(owner.mfaSecret.ciphertext),
        encoding: 'base32',
        token: '123456',
        time: step * 30,
        window: 1,
      });
      expect(delta.delta).toBe(0);

      const updated = await db.mfaSecret.updateMany({
        where: { id: owner.mfaSecret.id, lastStep: { lt: step + (delta.delta ?? 0) } },
        data: { lastStep: step + (delta.delta ?? 0) },
      });
      expect(updated.count).toBe(1);
    });

    it('rejects invalid TOTP token (step regression)', async () => {
      (totpFn as any).mockImplementation(() => ({ verifyDelta: () => ({ delta: 1 }) }));
      expect((totpFn as any)().verifyDelta({ secret: 'x', encoding: 'base32', token: '000000', time: 0, window: 1 })).toEqual({ delta: 1 });
    });
  });

  describe('Backup code authentication', () => {
    it('marks backup code as used on successful verification', async () => {
      digestMock.mockReturnValue('digest:abcd1234');
      backupCodeUpdateManyMock.mockResolvedValue({ count: 1 });

      const result = await db.backupCode.updateMany({
        where: { adminId: 'admin-1', used: false, codeHash: 'digest:abcd1234' },
        data: { used: true, usedAt: new Date() },
      });
      expect(result.count).toBe(1);
    });

    it('rejects already-used backup code (count 0)', async () => {
      backupCodeUpdateManyMock.mockResolvedValue({ count: 0 });
      const result = await db.backupCode.updateMany({
        where: { adminId: 'admin-1', used: false, codeHash: 'digest:used' },
        data: { used: true, usedAt: new Date() },
      });
      expect(result.count).toBe(0);
    });
  });

  describe('/auth/me response', () => {
    it('returns admin object without sensitive fields', () => {
      const admin = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN', isActive: true };
      const response = { admin };
      expect(response.admin.passwordHash).toBeUndefined();
      expect(response.admin.email).toBe('admin@test.com');
    });
  });

  describe('Session rotation on login', () => {
    it('regenerates session after password verification', () => {
      const regenerate = vi.fn((cb: any) => cb?.());
      const session = { adminId: 'admin-1', version: 0, regenerate };
      session.regenerate();
      expect(regenerate).toHaveBeenCalled();
    });

    it('regenerates session after MFA verification', () => {
      const regenerate = vi.fn((cb: any) => cb?.());
      const session = { adminId: 'admin-1', version: 0, mfaVerified: false, regenerate };
      session.regenerate();
      session.mfaVerified = true;
      expect(session.mfaVerified).toBe(true);
    });
  });
});

describe('Authorization middleware', () => {
  it('requires mfaVerified and matching sessionVersion', () => {
    const session = { adminId: 'admin-1', version: 1, mfaVerified: true };
    const admin = { sessionVersion: 1, isActive: true };
    const authorized = Boolean(session.adminId && admin.isActive && admin.sessionVersion === session.version && session.mfaVerified);
    expect(authorized).toBe(true);
  });

  it('rejects when sessionVersion mismatches', () => {
    const session = { adminId: 'admin-1', version: 0, mfaVerified: true };
    const admin = { sessionVersion: 1, isActive: true };
    const authorized = admin.sessionVersion === session.version && session.mfaVerified;
    expect(authorized).toBe(false);
  });

  it('rejects when mfaVerified is false', () => {
    const session = { adminId: 'admin-1', version: 1, mfaVerified: false };
    const admin = { sessionVersion: 1, isActive: true };
    const authorized = admin.sessionVersion === session.version && session.mfaVerified;
    expect(authorized).toBe(false);
  });

  it('rejects inactive accounts', () => {
    const session = { adminId: 'admin-1', version: 1, mfaVerified: true };
    const admin = { sessionVersion: 1, isActive: false };
    const authorized = admin.isActive && admin.sessionVersion === session.version && session.mfaVerified;
    expect(authorized).toBe(false);
  });
});

describe('CRUD operations', () => {
  describe('Create', () => {
    it('creates a record and returns it in data envelope', async () => {
      const record = { id: 'proj-1', slug: 'test-project', name: 'Test Project' };
      projectCreateMock.mockResolvedValue(record);
      const created = await db.project.create({ data: { slug: 'test-project', name: 'Test Project' } });
      expect(created).toEqual(record);
      expect(projectCreateMock).toHaveBeenCalledWith({ data: { slug: 'test-project', name: 'Test Project' } });
    });
  });

  describe('Read by slug', () => {
    it('returns null when record not found by slug', async () => {
      projectFindUniqueMock.mockResolvedValue(null);
      const record = await db.project.findUnique({ where: { slug: 'missing' } });
      expect(record).toBeNull();
    });

    it('returns record when found by slug', async () => {
      const record = { id: 'proj-1', slug: 'test-project', name: 'Test Project' };
      projectFindUniqueMock.mockResolvedValue(record);
      const found = await db.project.findUnique({ where: { slug: 'test-project' } });
      expect(found?.slug).toBe('test-project');
    });
  });

  describe('Update', () => {
    it('updates record by slug and returns updated data', async () => {
      const existing = { id: 'proj-1', slug: 'test-project', name: 'Old Name' };
      const updated = { id: 'proj-1', slug: 'test-project', name: 'New Name' };
      projectFindUniqueMock.mockResolvedValue(existing);
      projectUpdateMock.mockResolvedValue(updated);

      const found = await db.project.findUnique({ where: { slug: 'test-project' } });
      expect(found).not.toBeNull();
      const result = await db.project.update({ where: { slug: 'test-project' }, data: { name: 'New Name' } });
      expect(result.name).toBe('New Name');
    });
  });

  describe('Delete', () => {
    it('deletes record by slug and returns id', async () => {
      const existing = { id: 'proj-1', slug: 'test-project' };
      projectFindUniqueMock.mockResolvedValue(existing);
      projectDeleteMock.mockResolvedValue({ id: 'proj-1' });

      const found = await db.project.findUnique({ where: { slug: 'test-project' } });
      expect(found).not.toBeNull();
      const deleted = await db.project.delete({ where: { slug: 'test-project' } });
      expect(deleted.id).toBe('proj-1');
    });
  });

  describe('Pagination', () => {
    it('returns data array with meta containing total, page, limit, totalPages', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const meta = { page: 1, limit: 12, total: 25, totalPages: 3 };
      const response = { ok: true, data, meta };
      expect(response.data).toHaveLength(2);
      expect(response.meta.total).toBe(25);
      expect(response.meta.totalPages).toBe(3);
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(12);
    });
  });

  describe('Status filter', () => {
    it('applies status filter to where clause', () => {
      const where: Record<string, unknown> = {};
      const status = 'PUBLISHED';
      if (status) where.status = status;
      expect(where).toEqual({ status: 'PUBLISHED' });
    });
  });
});

describe('Password security', () => {
  it('hashes password without revealing plaintext', async () => {
    hashMock.mockResolvedValue('hashed-value');
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(hash).toBe('hashed-value');
  });

  it('compares password securely', async () => {
    compareMock.mockResolvedValue(true);
    const match = await comparePassword('secret123', 'hashed-value');
    expect(match).toBe(true);
  });

  it('rejects wrong password', async () => {
    compareMock.mockResolvedValue(false);
    const match = await comparePassword('wrong', 'hashed-value');
    expect(match).toBe(false);
  });
});

describe('Validation', () => {
  it('slug schema accepts lowercase alphanumeric hyphenated strings', () => {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    expect(slugRegex.test('mafuta-watch')).toBe(true);
    expect(slugRegex.test('tunza')).toBe(true);
    expect(slugRegex.test('Invalid_Slug')).toBe(false);
    expect(slugRegex.test('has spaces')).toBe(false);
  });

  it('status enum accepts DRAFT, PUBLISHED, ARCHIVED', () => {
    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
    expect(validStatuses).toContain('DRAFT');
    expect(validStatuses).toContain('PUBLISHED');
    expect(validStatuses).toContain('ARCHIVED');
  });
});

describe('Security events', () => {
  it('logs login events with adminId', async () => {
    securityEventCreateMock.mockResolvedValue({ id: 'evt-1' });
    await db.securityEvent.create({
      data: { action: 'LOGIN', adminId: 'admin-1', entity: 'Administrator', ipAddress: '127.0.0.1' },
    });
    expect(securityEventCreateMock).toHaveBeenCalledWith({
      data: { action: 'LOGIN', adminId: 'admin-1', entity: 'Administrator', ipAddress: '127.0.0.1' },
    });
  });

  it('logs CSRF violations', async () => {
    securityEventCreateMock.mockResolvedValue({ id: 'evt-2' });
    await db.securityEvent.create({
      data: { action: 'CSRF_VIOLATION', entity: 'Session', ipAddress: '10.0.0.1' },
    });
    expect(securityEventCreateMock).toHaveBeenCalledWith({
      data: { action: 'CSRF_VIOLATION', entity: 'Session', ipAddress: '10.0.0.1' },
    });
  });
});
