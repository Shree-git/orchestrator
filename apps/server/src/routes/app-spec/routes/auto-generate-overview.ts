/**
 * POST /auto-generate-overview endpoint - Auto-generate project overview from codebase
 */

import type { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createLogger } from '@automaker/utils';
import { createSpecGenerationOptions } from '../../../lib/sdk-options.js';
import * as secureFs from '../../../lib/secure-fs.js';
import path from 'path';

const logger = createLogger('AutoGenerateOverview');

interface AutoGenerateOverviewRequest {
  projectPath: string;
}

interface AutoGenerateOverviewResponse {
  success: boolean;
  overview?: string;
  error?: string;
}

export async function autoGenerateOverview(req: Request, res: Response): Promise<void> {
  try {
    const { projectPath }: AutoGenerateOverviewRequest = req.body;

    if (!projectPath) {
      res.status(400).json({
        success: false,
        error: 'projectPath is required',
      });
      return;
    }

    logger.info('Auto-generating project overview for:', projectPath);

    // Build prompt for analyzing the codebase
    const prompt = `You are helping to generate a project overview by analyzing the codebase. Your goal is to create a concise but informative project description.

Analyze this project directory thoroughly to understand:
1. What type of application this is
2. Key features and functionality
3. Technologies and frameworks used
4. Project structure and architecture
5. Any existing documentation (README files, etc.)

Use the Read, Glob, and Grep tools to explore:
- README files and documentation
- package.json files to understand dependencies and scripts
- Source code structure and key files
- Configuration files
- Any existing specifications or documentation

Based on your analysis, generate a 2-4 paragraph project overview that includes:
- What the project does (main purpose and features)
- Technology stack being used
- Key architectural patterns or structure
- Any notable features or capabilities you discovered

Keep the overview concise but informative - it should give someone a clear understanding of what this project is and what it does. Focus on the functional aspects rather than technical implementation details.

If you can't find much information or the project appears empty, generate a reasonable overview based on the directory name and any clues you can find.

Return ONLY the project overview text, no additional commentary or explanations.`;

    const abortController = new AbortController();
    const options = createSpecGenerationOptions({
      cwd: projectPath,
      abortController,
    });

    logger.debug('Calling Claude Agent SDK to generate overview...');

    const stream = query({ prompt, options });
    let responseText = '';

    for await (const msg of stream) {
      if (msg.type === 'assistant') {
        const msgAny = msg as any;
        if (msgAny.message?.content) {
          for (const block of msgAny.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }
      } else if (msg.type === 'result' && (msg as any).subtype === 'success') {
        logger.info('✅ Overview generation completed');
        break;
      } else if (msg.type === 'result' && (msg as any).subtype === 'error_max_turns') {
        logger.error('❌ Hit max turns limit during overview generation');
        break;
      }
    }

    if (!responseText.trim()) {
      logger.error('❌ No overview text generated');
      res.status(500).json({
        success: false,
        error: 'Failed to generate project overview',
      });
      return;
    }

    // Clean up the response text
    const cleanedOverview = responseText.trim();

    logger.info(`✅ Generated overview: ${cleanedOverview.length} characters`);
    logger.debug(`Overview preview: ${cleanedOverview.substring(0, 200)}...`);

    res.json({
      success: true,
      overview: cleanedOverview,
    });
  } catch (error) {
    logger.error('❌ Error generating project overview:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
