// MongoDB connection (one database per service, same Atlas cluster).
import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  await mongoose.connect(env.mongoUri, { dbName: env.dbName });
  console.log(`[${env.serviceName}] MongoDB connected (db: ${env.dbName})`);
};
