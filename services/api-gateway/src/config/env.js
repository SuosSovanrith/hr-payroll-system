// Reads and validates environment variables once, at startup.
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const env = {
  serviceName: 'api-gateway',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  jwtSecret: required('JWT_SECRET'), // must be the same secret the Login Service signs with
  internalKey: required('INTERNAL_API_KEY'), // added to every proxied request so services trust the gateway
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  auditServiceUrl: process.env.AUDIT_SERVICE_URL || '',
  // Where each downstream service lives (docker service name locally, EC2 private IP when deployed).
  serviceUrls: {
    registration: process.env.REGISTRATION_SERVICE_URL || 'http://registration-service:3001',
    login: process.env.LOGIN_SERVICE_URL || 'http://login-service:3002',
    employee: process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:3003',
    attendance: process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3004',
    leave: process.env.LEAVE_SERVICE_URL || 'http://leave-service:3005',
    performance: process.env.PERFORMANCE_SERVICE_URL || 'http://performance-service:3006',
    payroll: process.env.PAYROLL_SERVICE_URL || 'http://payroll-service:3007',
    audit: process.env.AUDIT_SERVICE_URL || 'http://audit-service:3008',
  },
};
