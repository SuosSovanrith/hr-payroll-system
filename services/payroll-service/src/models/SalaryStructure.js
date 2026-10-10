// `salarystructures` collection (hr_payroll DB). One document per employee: their monthly base salary.
import mongoose from 'mongoose';

const salaryStructureSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    baseSalary: { type: Number, required: true, min: 0 }, // per month
    currency: { type: String, default: 'USD' },
    updatedBy: { type: String }, // userId of the HR/Admin who last changed it
  },
  { timestamps: true },
);

export default mongoose.model('SalaryStructure', salaryStructureSchema);
