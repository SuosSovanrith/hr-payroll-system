// API Gateway: the ONLY public entry point (behind Nginx). Request flow:
//   Nginx -> auditLogger -> routeGuard (route table + JWT + RBAC) -> proxy -> downstream service
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'node:os';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env } from './config/env.js';
import { routeGuard } from './middleware/routeGuard.js';
import { auditLogger } from './middleware/auditLogger.js';
import { lbInfo } from './routes/lbInfo.js';
import { errorHandler } from './common/errorHandler.js';

const app = express();
app.set('trust proxy', 1); // exactly one proxy (Nginx) in front: req.ip = the IP Nginx saw, not a client-supplied one

// Tell the client which gateway instance answered (visible in Postman response headers).
app.use((req, res, next) => {
  res.setHeader('X-Served-By', os.hostname());
  next();
});
app.use(helmet());
app.use(morgan(`:method :url :status :response-time ms [${os.hostname()}]`));
// NOTE: no express.json() here on purpose - the raw request body is streamed to the service untouched.

// Handled by the gateway itself (not proxied)
app.get('/health', (req, res) => res.json({ status: 'ok', service: env.serviceName, instanceId: os.hostname() }));
app.get('/api/lb-info', lbInfo);

app.use(auditLogger);
app.use(routeGuard);

// Forward to the service chosen by the matched rule. The path is forwarded unchanged.
app.use(
  createProxyMiddleware({
    target: 'http://placeholder', // required by the library; real target comes from `router`
    router: (req) => env.serviceUrls[req.rule.service],
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 15000,
    on: {
      error: (err, req, res) => {
        console.error(`[proxy] ${req.rule?.service} unreachable: ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 'BAD_GATEWAY', message: `Service "${req.rule?.service}" is unreachable` } }));
      },
    },
  }),
);

app.use(errorHandler);

export default app;
