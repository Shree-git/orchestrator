/**
 * Git routes - HTTP API for git operations (non-worktree)
 */

import { Router } from 'express';
import { createDiffsHandler } from './routes/diffs.js';
import { createFileDiffHandler } from './routes/file-diff.js';

export function createGitRoutes(): Router {
  const router = Router();

  router.post('/diffs', createDiffsHandler());
  router.post('/file-diff', createFileDiffHandler());

  return router;
}
