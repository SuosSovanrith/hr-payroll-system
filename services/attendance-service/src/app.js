// Express app: middleware, health check, then the route groups of this service.
import express from 'express';
import morgan from 'morgan';
import os from 'node:os';
import { env } from './config/env.js';
import { fromGateway, internalAuth } from './common/gatewayAuth.js';
import { notFoundHandler, errorHandler } from './common/errorHandler.js';
import attendanceRoutes from './routes/attendance.routes.js';
import internalRoutes from './routes/internal.routes.js';

const app = express();
app.use(morgan('tiny'));
app.use(express.json());

// Health check: used by the Docker HEALTHCHECK and handy for demos.
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: env.serviceName, instanceId: os.hostname() }),
);

// Public APIs (reached through the gateway). Requests without the gateway key are rejected.
app.use('/api', fromGateway);
app.use('/api/attendance', attendanceRoutes);

// Service-to-service APIs (NOT exposed by the gateway). Require the internal key.
app.use('/internal', internalAuth);
app.use('/internal/attendance', internalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
