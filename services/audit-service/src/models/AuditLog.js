// `auditlogs` collection (hr_audit DB). APPEND-ONLY: there are intentionally no update/delete endpoints.
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String, index: true }, // who did it (absent for anonymous requests / failed logins)
    actorRole: { type: String },
    action: { type: String, required: true, index: true }, // e.g. LOGIN_FAILED, ROLE_CHANGED, PAYSLIP_GENERATED, ACCESS_DENIED
    service: { type: String, index: true }, // which service reported it
    resource: { type: String },
    resourceId: { type: String },
    method: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
    ip: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export default mongoose.model('AuditLog', auditLogSchema);
