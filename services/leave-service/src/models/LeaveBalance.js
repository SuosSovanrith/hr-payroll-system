// `leavebalances` collection (hr_leave DB). One document per user per year.
// Created lazily with the defaults below the first time a user's balance is needed.
import mongoose from 'mongoose';

const bucket = (allocated) => ({
  allocated: { type: Number, default: allocated },
  used: { type: Number, default: 0 },
});

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    year: { type: Number, required: true, default: () => new Date().getFullYear() },
    annual: bucket(14), // default 14 days
    sick: bucket(7), // default 7 days   (unpaid leave has no balance)
  },
  { timestamps: true },
);

leaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
