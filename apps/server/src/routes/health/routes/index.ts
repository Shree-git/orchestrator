/**
 * GET / endpoint - Basic health check
 */

import type { Request, Response } from 'express';

export function createIndexHandler() {
  return (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  };
}
