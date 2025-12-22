/**
 * POST /install-codex endpoint - Install Codex CLI
 */

import type { Request, Response } from 'express';
import { getErrorMessage, logError } from '../common.js';

export function createInstallCodexHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      // In web mode, we can't install CLIs directly
      // Return instructions instead
      res.json({
        success: false,
        error:
          'CLI installation requires terminal access. Please install manually using: npm install -g @openai/codex',
        installCommands: {
          npm: 'npm install -g @openai/codex',
        },
      });
    } catch (error) {
      logError(error, 'Install Codex CLI failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
