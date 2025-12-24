/**
 * POST /cleanup-orphaned endpoint - Clean up orphaned terminal sessions for a deleted project
 */

import type { Request, Response } from 'express';
import { getTerminalService } from '../../../services/terminal-service.js';
import { getErrorMessage, logError } from '../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('Terminal');

export function createCleanupHandler() {
  return (req: Request, res: Response): void => {
    try {
      const { projectPath } = req.body;

      if (!projectPath || typeof projectPath !== 'string') {
        res.status(400).json({
          success: false,
          error: 'projectPath is required and must be a string',
        });
        return;
      }

      const terminalService = getTerminalService();
      const cleanedCount = terminalService.cleanupSessionsForProject(projectPath);

      logger.info(
        `[Cleanup] Cleaned up ${cleanedCount} terminal sessions for project: ${projectPath}`
      );

      res.json({
        success: true,
        cleaned: cleanedCount,
        message: `Cleaned up ${cleanedCount} terminal sessions for project: ${projectPath}`,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('Failed to cleanup orphaned sessions', errorMessage);

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  };
}
