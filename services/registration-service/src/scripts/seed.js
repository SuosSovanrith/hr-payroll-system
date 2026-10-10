// Creates demo accounts so everyone can log in immediately.
//   Docker : docker compose exec registration-service node src/scripts/seed.js
//   Local  : npm run seed
// Safe to run many times (existing emails are skipped). CHANGE THESE PASSWORDS for any real deployment.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ROLES } from '../common/roles.js';

const demoUsers = [
  { email: 'admin@company.com', password: 'Admin@123', fullName: 'System Admin', role: ROLES.ADMIN },
  { email: 'hr@company.com', password: 'Hr@12345', fullName: 'Helen HR', role: ROLES.HR },
  { email: 'employee@company.com', password: 'Emp@12345', fullName: 'Eric Employee', role: ROLES.EMPLOYEE },
];

await mongoose.connect(env.mongoUri, { dbName: env.dbName });

for (const u of demoUsers) {
  if (await User.exists({ email: u.email })) {
    console.log(`skip   ${u.email} (already exists)`);
    continue;
  }
  const { password, ...rest } = u;
  await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
  console.log(`create ${u.email}  /  ${password}  (${u.role})`);
}

await mongoose.disconnect();
