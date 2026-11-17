import { Prisma, SecurityEvent as SecurityEventModel } from '@prisma/client';
import { db } from '../config/db';

export type SecurityAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'MFA_VERIFY'
  | 'MFA_SETUP'
  | 'MFA_DISABLE'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'RECOVERY_REQUEST'
  | 'RECOVERY_COMPLETE'
  | 'SESSION_REVOKED'
  | 'CSRF_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PROVISION_OWNER';

export interface LogSecurityEventInput {
  adminId?: string | null;
  action: SecurityAction;
  entity: string;
  entityId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logSecurityEvent(input: LogSecurityEventInput): Promise<SecurityEventModel> {
  return db.securityEvent.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
