import { Router, Request, Response } from 'express';
import { CodexUsageService } from '../../services/codex-usage-service.js';
import type { CodexUsageResponse, CodexStatusResponse, CodexUsageRefreshRequest } from './types.js';

export function createCodexRoutes(service: CodexUsageService): Router {
  const router = Router();

  // Get current usage (attempts to fetch from Codex CLI or OpenAI API)
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      // Check if any Codex CLI is available first
      const isAvailable = await service.isAvailable();
      const isAuthenticated = await service.isAuthenticated();

      if (!isAvailable && !isAuthenticated) {
        res.status(503).json({
          success: false,
          error: 'Codex CLI not found and no API key available',
          message: 'Please install Codex CLI or set OPENAI_API_KEY environment variable',
        } as CodexUsageResponse);
        return;
      }

      if (!isAuthenticated) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message:
            "Please set OPENAI_API_KEY environment variable or run 'codex login' to authenticate",
        } as CodexUsageResponse);
        return;
      }

      const usage = await service.fetchUsageData();
      res.json({
        success: true,
        data: usage,
      } as CodexUsageResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('Authentication required') || message.includes('unauthorized')) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message:
            "Please set OPENAI_API_KEY environment variable or run 'codex login' to authenticate",
        } as CodexUsageResponse);
      } else if (message.includes('timed out')) {
        res.status(504).json({
          success: false,
          error: 'Command timed out',
          message: 'The Codex CLI took too long to respond',
        } as CodexUsageResponse);
      } else if (message.includes('not found') || message.includes('command not found')) {
        res.status(503).json({
          success: false,
          error: 'Codex CLI not found',
          message: 'Please install Codex CLI to access usage information',
        } as CodexUsageResponse);
      } else {
        console.error('Error fetching Codex usage:', error);
        res.status(500).json({
          success: false,
          error: message,
        } as CodexUsageResponse);
      }
    }
  });

  // Refresh usage data (force fresh fetch)
  router.post('/usage/refresh', async (req: Request, res: Response) => {
    try {
      const { forceRefresh = true } = req.body as CodexUsageRefreshRequest;

      const isAuthenticated = await service.isAuthenticated();
      if (!isAuthenticated) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message:
            "Please set OPENAI_API_KEY environment variable or run 'codex login' to authenticate",
        } as CodexUsageResponse);
        return;
      }

      // For now, refresh is the same as regular fetch since we don't cache
      // In the future, this could clear caches or force API calls
      const usage = await service.fetchUsageData();
      res.json({
        success: true,
        data: usage,
      } as CodexUsageResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing Codex usage:', error);
      res.status(500).json({
        success: false,
        error: message,
      } as CodexUsageResponse);
    }
  });

  // Get Codex status (availability and authentication status)
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isAvailable = await service.isAvailable();
      const isAuthenticated = await service.isAuthenticated();

      let status;
      if (!isAvailable && !isAuthenticated) {
        status = {
          indicator: { color: 'gray' as const },
          description: 'Codex CLI not found and no API key configured',
        };
      } else if (!isAuthenticated) {
        status = {
          indicator: { color: 'red' as const },
          description: 'Authentication required - set OPENAI_API_KEY or run codex login',
        };
      } else if (!isAvailable) {
        status = {
          indicator: { color: 'yellow' as const },
          description: 'Using API key authentication (CLI not available)',
        };
      } else {
        status = {
          indicator: { color: 'green' as const },
          description: 'Codex CLI available and authenticated',
        };
      }

      res.json({
        success: true,
        data: status,
      } as CodexStatusResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking Codex status:', error);
      res.status(500).json({
        success: false,
        error: message,
      } as CodexStatusResponse);
    }
  });

  // Check authentication status
  router.get('/auth', async (req: Request, res: Response) => {
    try {
      const isAvailable = await service.isAvailable();
      const isAuthenticated = await service.isAuthenticated();

      res.json({
        success: true,
        data: {
          available: isAvailable,
          authenticated: isAuthenticated,
          method: isAuthenticated
            ? process.env.OPENAI_API_KEY
              ? 'api_key_env'
              : 'cli_authenticated'
            : 'none',
          hasApiKey: !!process.env.OPENAI_API_KEY,
          hasCliAccess: isAvailable,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking Codex auth status:', error);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  return router;
}
