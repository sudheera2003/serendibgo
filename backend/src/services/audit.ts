import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** Records every administrative action for traceability. */
export function audit(actorId: number, action: string, entityType: string, entityId?: number, details?: Prisma.InputJsonValue) {
  return prisma.auditLog.create({ data: { actorId, action, entityType, entityId, details } });
}
