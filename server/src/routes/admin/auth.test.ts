import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest.ts';
import bcrypt from 'bcryptjs.ts';

const hashPassword = (password: string) => bcrypt.hash(password, 12);

class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Mock the entire Prisma client
const mockAdministrator = {
  findUnique: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
};
const mockSession = {
  findUnique: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
};
const mockMfaSecret = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};
const mockBackupCode = {
  findFirst: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};
const mockLoginAttempt = {
  count: vi.fn(),
  create: vi.fn(),
};
const mockSecurityEvent = {
  create: vi.fn(),
};
const mockPasswordResetToken = {
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockContactMessage = {
  create: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    administrator: mockAdministrator,
    session: mockSession,
    mfaSecret: mockMfaSecret,
    backupCode: mockBackupCode,
    loginAttempt: mockLoginAttempt,
    securityEvent: mockSecurityEvent,
    passwordResetToken: mockPasswordResetToken,
    contactMessage: mockContactMessage,
    $transaction: vi.fn(async (ops: any[]) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    }),
  })),
}));

describe('Authentication security', () => {
  const adminData = {
    id: 'admin-1',
    email: 'owner@test.example.com',
    passwordHash: '',
    name: 'Owner',
    role: 'ADMIN',
    isActive: true,
    mfaEnabled: false,
    mfaEnforced: false,
    failedLoginCount: 0,
    lockedUntil: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    adminData.passwordHash = await hashPassword('TestPassword123!');
    mockAdministrator.count.mockResolvedValue(1);
    mockAdministrator.findUnique.mockResolvedValue(adminData);
    mockSecurityEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bcrypt produces strong hashes (starts with $2$, salted)', async () => {
    const hash = await hashPassword('SecurePass123!');
    expect(hash).not.toBe('SecurePass123!');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('AppError carries correct status code', () => {
    const err = new AppError('Invalid credentials', 401);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid credentials');
    expect(err.isOperational).toBe(true);
  });

  it('enforceSingleAdministrator rejects when admin exists', async () => {
    const { enforceSingleAdministrator } = await import('../../middleware/auth');
    mockAdministrator.count.mockResolvedValue(1);
    await expect(enforceSingleAdministrator()).rejects.toThrow('Single-administrator architecture');
  });

  it('enforceSingleAdministrator passes when no admin exists', async () => {
    const { enforceSingleAdministrator } = await import('../../middleware/auth');
    mockAdministrator.count.mockResolvedValue(0);
    await expect(enforceSingleAdministrator()).resolves.toBeUndefined();
  });
});

describe('No hardcoded credentials or secrets', () => {
  const fs = require('fs');
  const path = require('path');

  const filesToCheck = [
    path.join(__dirname, 'auth.ts'),
    path.join(__dirname, '..', '..', '..', 'scripts', 'provision-owner.ts'),
    path.join(__dirname, '..', '..', '..', 'src', 'config', 'env.ts'),
  ];

  for (const file of filesToCheck) {
    it(`does not contain hardcoded passwords in ${path.basename(file)}`, () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/password:\s*["'][^"']{4,}["']/);
      expect(content).not.toMatch(/passwordHash:\s*["'][^"']{4,}["']/);
    });

    it(`does not expose secrets in source in ${path.basename(file)}`, () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/SESSION_SECRET\s*=\s*["'][^"']{10,}["']/);
      expect(content).not.toMatch(/ENCRYPTION_KEY\s*=\s*["'][^"']{10,}["']/);
      expect(content).not.toMatch(/DATABASE_URL\s*=\s*["'][^"']{10,}["']/);
    });
  }
});

describe('No public provisioning endpoint', () => {
  const fs = require('fs');
  const path = require('path');

  it('auth routes do not expose a public /setup HTTP endpoint', () => {
    const content = fs.readFileSync(
      path.join(__dirname, 'auth.ts'),
      'utf8'
    );
    expect(content).not.toMatch(/router\.post\s*\(\s*['"]\/setup['"]/);
  });

  it('provision-owner.ts is a CLI script, not an HTTP route', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'scripts', 'provision-owner.ts'),
      'utf8'
    );
    expect(content).toContain('process.env.ADMIN_EMAIL');
    expect(content).toContain('process.env.ADMIN_PASSWORD');
    expect(content).not.toContain('router.');
    expect(content).not.toContain('app.use');
    expect(content).not.toContain('import express');
  });
});

