// `employees` collection (hr_employee DB). One profile per user account.
// NOTE: `userId` is the _id of the user in the hr_auth DB (as a string). It is the employee ID used by ALL services.
import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    dateOfBirth: { type: Date },
    department: { type: String, required: true, trim: true }, // plain string, e.g. "Engineering"
    jobTitle: { type: String, required: true, trim: true },
    employmentType: { type: String, enum: ['full_time', 'part_time', 'contract'], default: 'full_time' },
    hireDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'terminated'], default: 'active' }, // delete = soft delete
  },
  { timestamps: true },
);

export default mongoose.model('Employee', employeeSchema);
