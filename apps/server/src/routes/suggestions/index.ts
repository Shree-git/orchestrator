/**
 * Suggestions routes - HTTP API for AI-powered feature suggestions
 */

import { Router } from 'express';
import type { EventEmitter } from '../../lib/events.js';
import { createGenerateHandler } from './routes/generate.js';
import { createStopHandler } from './routes/stop.js';
import { createStatusHandler } from './routes/status.js';

export function createSuggestionsRoutes(events: EventEmitter): Router {
  const router = Router();

  router.post('/generate', createGenerateHandler(events));
  router.post('/stop', createStopHandler());
  router.get('/status', createStatusHandler());

  return router;
}
