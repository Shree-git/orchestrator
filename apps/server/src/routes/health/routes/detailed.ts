/**
 * GET /detailed endpoint - Detailed health check
 */

import type { Request, Response } from 'express';
import { getAuthStatus } from '../../../lib/auth.js';

export function createDetailedHandler() {
  return (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dataDir: process.env.DATA_DIR || './data',
      auth: getAuthStatus(),
      env: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  };
}
