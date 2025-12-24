import { Router, Request, Response } from 'express';
import { ClaudeUsageService } from '../../services/claude-usage-service.js';

export function createClaudeRoutes(service: ClaudeUsageService): Router {
  const router = Router();

  // Get current usage (fetches from Claude CLI)
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      // Check if Claude CLI is available first
      const isAvailable = await service.isAvailable();
      if (!isAvailable) {
        res.status(503).json({
          error: 'Claude CLI not found',
          message: "Please install Claude Code CLI and run 'claude login' to authenticate",
        });
        return;
      }

      const usage = await service.fetchUsageData();
      res.json(usage);
    } catch (error) {
      let message = 'Unknown error';

      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      } else if (error && typeof error === 'object' && 'toString' in error) {
        try {
          message = error.toString();
        } catch (e) {
          message = 'Error converting error message to string';
        }
      }

      if (message.includes('Authentication required') || message.includes('token_expired')) {
        res.status(401).json({
          error: 'Authentication required',
          message: "Please run 'claude login' to authenticate",
        });
      } else if (message.includes('timed out')) {
        res.status(504).json({
          error: 'Command timed out',
          message: 'The Claude CLI took too long to respond',
        });
      } else {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: message });
      }
    }
  });

  return router;
}
