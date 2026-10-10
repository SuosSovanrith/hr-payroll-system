// `payslips` collection (hr_payroll DB). One payslip per employee per month (generated, then never recalculated).
import mongoose from 'mongoose';

const payslipSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "YYYY-MM"
    // Snapshot of employee details at generation time (so old payslips never change if the profile changes).
    employee: { name: String, department: String, jobTitle: String },
    baseSalary: { type: Number, required: true },
    overtimeHours: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    gross: { type: Number, required: true },
    deductions: { tax: Number, social: Number, total: Number },
    net: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    generatedBy: { type: String }, // userId of the HR/Admin who generated it
  },
  { timestamps: true },
);

payslipSchema.index({ userId: 1, month: 1 }, { unique: true }); // generating twice for a month -> duplicate (409)

export default mongoose.model('Payslip', payslipSchema);
