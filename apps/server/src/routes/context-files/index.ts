import { Router } from 'express';
import { router as autoDiscoverRouter } from './auto-discover.js';

export function createContextFilesRoutes(): Router {
  const router = Router();

  // Mount auto-discover routes
  router.use('/', autoDiscoverRouter);

  return router;
}
