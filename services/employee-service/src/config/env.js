// Reads and validates environment variables once, at startup.
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const env = {
  serviceName: 'employee-service',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3003,
  mongoUri: required('MONGODB_URI'),
  dbName: process.env.DB_NAME || 'hr_employee', // each service owns its own database
  internalKey: required('INTERNAL_API_KEY'), // shared secret: gateway <-> services
  auditServiceUrl: process.env.AUDIT_SERVICE_URL || '', // optional: where to send audit events

};
