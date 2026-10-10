// `leaverequests` collection (hr_leave DB).
import mongoose from 'mongoose';

export const LEAVE_TYPES = ['annual', 'sick', 'unpaid'];

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 }, // calendar days between start and end (inclusive)
    reason: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    reviewedBy: { type: String }, // userId of the HR/Admin who decided
    reviewComment: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model('LeaveRequest', leaveRequestSchema);
