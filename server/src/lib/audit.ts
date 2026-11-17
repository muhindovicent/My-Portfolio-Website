import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../config/db';

export async function auditLog({
  req,
  action,
  entity,
  entityId,
  metadata,
}: {
  req: AuthenticatedRequest;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      adminId: req.admin?.id ?? null,
      action,
      entity,
      entityId,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: (req as any).ip ?? ((req.headers as any)['x-forwarded-for'] ?? null),
    },
  });
}
