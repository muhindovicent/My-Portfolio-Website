import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest.ts';

vi.mock('../../src/config/db', () => ({
  db: {
    securityEvent: {
      create: vi.fn(),
    },
  },
}));

import { db } from '../../src/config/db.ts.ts';
import { logSecurityEvent, type SecurityAction } from './securityEvent.ts.ts';

const createMock = vi.mocked(db.securityEvent.create);

describe('logSecurityEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a security event with all fields', async () => {
    createMock.mockResolvedValue({ id: 'event-1' } as any);

    const result = await logSecurityEvent({
      adminId: 'admin-1',
      action: 'LOGIN',
      entity: 'Administrator',
      entityId: 'admin-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: { mfaRequired: true },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        adminId: 'admin-1',
        action: 'LOGIN',
        entity: 'Administrator',
        entityId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        metadata: { mfaRequired: true },
      },
    });
    expect(result).toEqual({ id: 'event-1' } as any);
  });

  it('handles null optional fields', async () => {
    createMock.mockResolvedValue({ id: 'event-2' } as any);

    await logSecurityEvent({
      adminId: null,
      action: 'LOGIN_FAILED',
      entity: 'Administrator',
      entityId: null,
      ipAddress: '10.0.0.1',
      userAgent: null,
      metadata: undefined,
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        adminId: null,
        action: 'LOGIN_FAILED',
        entity: 'Administrator',
        entityId: null,
        ipAddress: '10.0.0.1',
        userAgent: null,
        metadata: undefined,
      },
    });
  });

  it('supports all security actions', async () => {
    createMock.mockResolvedValue({ id: 'event-3' } as any);

    const actions: SecurityAction[] = [
      'LOGIN',
      'LOGIN_FAILED',
      'MFA_VERIFY',
      'MFA_SETUP',
      'MFA_DISABLE',
      'LOGOUT',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_COMPLETE',
      'RECOVERY_REQUEST',
      'RECOVERY_COMPLETE',
      'SESSION_REVOKED',
      'CSRF_VIOLATION',
      'RATE_LIMIT_EXCEEDED',
      'PROVISION_OWNER',
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED',
    ];

    for (const action of actions) {
      await logSecurityEvent({
        adminId: null,
        action,
        entity: 'Test',
        ipAddress: '127.0.0.1',
      });
    }

    expect(createMock).toHaveBeenCalledTimes(actions.length);
  });
});


