import mongoose from "mongoose";
import AuditLog from "../models/AuditLog";

export interface AuditLogInput {
  businessId: string | mongoose.Types.ObjectId;
  actorUserId: string | mongoose.Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string | mongoose.Types.ObjectId;
  description: string;
}

export async function recordAuditLog(
  input: AuditLogInput,
  session?: mongoose.ClientSession
): Promise<void> {
  const record = new AuditLog({
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    ...(input.resourceId !== undefined
      ? { resourceId: input.resourceId.toString() }
      : {}),
    description: input.description,
  });
  await record.save(session ? { session } : undefined);
}
