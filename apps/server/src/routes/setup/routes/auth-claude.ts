/**
 * POST /auth-claude endpoint - Auth Claude
 */

import type { Request, Response } from 'express';
import { getErrorMessage, logError } from '../common.js';

export function createAuthClaudeHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        requiresManualAuth: true,
        command: 'claude login',
        message: "Please run 'claude login' in your terminal to authenticate",
      });
    } catch (error) {
      logError(error, 'Auth Claude failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
