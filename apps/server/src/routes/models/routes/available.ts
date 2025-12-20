/**
 * GET /available endpoint - Get available models
 */

import type { Request, Response } from 'express';
import { getErrorMessage, logError } from '../common.js';

interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
}

export function createAvailableHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const models: ModelDefinition[] = [
        {
          id: 'claude-opus-4-5-20251101',
          name: 'Claude Opus 4.5',
          provider: 'anthropic',
          contextWindow: 200000,
          maxOutputTokens: 16384,
          supportsVision: true,
          supportsTools: true,
        },
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          contextWindow: 200000,
          maxOutputTokens: 16384,
          supportsVision: true,
          supportsTools: true,
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'anthropic',
          contextWindow: 200000,
          maxOutputTokens: 8192,
          supportsVision: true,
          supportsTools: true,
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          provider: 'anthropic',
          contextWindow: 200000,
          maxOutputTokens: 8192,
          supportsVision: true,
          supportsTools: true,
        },
      ];

      res.json({ success: true, models });
    } catch (error) {
      logError(error, 'Get available models failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
