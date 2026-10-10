// `users` collection in the hr_auth database.
// Registration WRITES users; Login (same hr_auth DB) READS them. Keep this file identical in both services.
import mongoose from 'mongoose';
import { ALL_ROLES, ROLES } from '../common/roles.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }, // bcrypt hash - never store or return the plain password
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ALL_ROLES, default: ROLES.EMPLOYEE },
    isActive: { type: Boolean, default: true }, // deactivated users cannot log in
  },
  { timestamps: true },
);

// Never leak the hash in API responses.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
