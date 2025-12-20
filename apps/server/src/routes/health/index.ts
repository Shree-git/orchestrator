/**
 * Health check routes
 */

import { Router } from 'express';
import { createIndexHandler } from './routes/index.js';
import { createDetailedHandler } from './routes/detailed.js';

export function createHealthRoutes(): Router {
  const router = Router();

  router.get('/', createIndexHandler());
  router.get('/detailed', createDetailedHandler());

  return router;
}
