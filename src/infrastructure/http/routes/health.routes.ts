import { Router } from 'express';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'bytemarket-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});
