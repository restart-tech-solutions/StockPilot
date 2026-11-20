import mongoose, { Document, Schema } from "mongoose";

export interface IAuditLog extends Document {
  businessId: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      immutable: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },
    resourceId: {
      type: String,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ businessId: 1, actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ businessId: 1, resourceType: 1, action: 1, createdAt: -1 });

const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
