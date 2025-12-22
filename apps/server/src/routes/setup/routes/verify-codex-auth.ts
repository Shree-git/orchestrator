/**
 * POST /verify-codex-auth endpoint - Verify Codex authentication by running a test query
 */

import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import { createLogger } from '@automaker/utils';
import { getApiKey } from '../common.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const logger = createLogger('Setup');

// Known error patterns that indicate auth failure
const AUTH_ERROR_PATTERNS = [
  'invalid_api_key',
  'authentication_error',
  'unauthorized',
  'not authenticated',
  'authentication failed',
  'invalid api key',
  'api key is invalid',
  'OPENAI_API_KEY',
  'missing api key',
  'no api key',
];

// Patterns that indicate rate/usage limits
const RATE_LIMIT_PATTERNS = ['rate limit', 'rate_limit', 'too many requests', 'quota exceeded'];

// Patterns that indicate auth is working but model isn't available
// This means the connection to OpenAI succeeded
const MODEL_NOT_SUPPORTED_PATTERNS = [
  'model is not supported',
  'not supported when using',
  'model not available',
];

function isRateLimitError(text: string): boolean {
  const lowerText = text.toLowerCase();
  return RATE_LIMIT_PATTERNS.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}

function containsAuthError(text: string): boolean {
  const lowerText = text.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}

function isModelNotSupported(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MODEL_NOT_SUPPORTED_PATTERNS.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}

async function checkCliAuth(): Promise<boolean> {
  const codexDir = path.join(os.homedir(), '.codex');
  const authJsonPath = path.join(codexDir, 'auth.json');

  try {
    const authContent = await fs.readFile(authJsonPath, 'utf-8');
    const authData = JSON.parse(authContent);

    // Check if there's a valid token (can be at top level or nested under 'tokens')
    const tokens = authData.tokens || authData;
    if (
      tokens.access_token ||
      tokens.api_key ||
      tokens.token ||
      authData.OPENAI_API_KEY ||
      authData.access_token
    ) {
      return true;
    }
  } catch {
    // No auth file or invalid format
  }

  return false;
}

async function findCodexCliPath(): Promise<string | null> {
  // Check common locations
  const possiblePaths = [
    'codex', // In PATH
    '/usr/local/bin/codex',
    '/opt/homebrew/bin/codex',
    path.join(os.homedir(), '.local', 'bin', 'codex'),
    path.join(os.homedir(), 'bin', 'codex'),
  ];

  // Also check npm global bin
  try {
    const { stdout: npmBin } = await execAsync('npm bin -g');
    possiblePaths.push(path.join(npmBin.trim(), 'codex'));
  } catch {
    // Ignore
  }

  for (const codexPath of possiblePaths) {
    try {
      await execAsync(`"${codexPath}" --version`);
      return codexPath;
    } catch {
      // Try next path
    }
  }

  // Try which/where command
  try {
    const cmd = process.platform === 'win32' ? 'where codex' : 'which codex';
    const { stdout } = await execAsync(cmd);
    const foundPath = stdout.trim().split('\n')[0];
    if (foundPath) {
      return foundPath;
    }
  } catch {
    // Not found
  }

  return null;
}

export function createVerifyCodexAuthHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { authMethod } = req.body as { authMethod?: 'cli' | 'api_key' };

      logger.info(`[Setup] Verifying Codex authentication using method: ${authMethod || 'auto'}`);

      // First check if Codex CLI is installed
      const cliPath = await findCodexCliPath();

      if (!cliPath) {
        res.json({
          success: true,
          authenticated: false,
          error: 'Codex CLI is not installed. Please install it with: npm install -g @openai/codex',
        });
        return;
      }

      // Check for API key or CLI auth
      const storedApiKey = getApiKey('openai');
      const envApiKey = process.env.OPENAI_API_KEY;
      const apiKey = storedApiKey || envApiKey;

      // Check if CLI is authenticated (has auth.json with tokens)
      const hasCliAuth = await checkCliAuth();

      if (!apiKey && !hasCliAuth) {
        res.json({
          success: true,
          authenticated: false,
          error: 'No OpenAI API key configured. Please enter an API key or run "codex login".',
        });
        return;
      }

      // Run a test query using the Codex CLI
      // If we have CLI auth, we don't need to pass an API key
      const authenticated = await runTestQuery(cliPath, hasCliAuth ? undefined : apiKey);

      logger.info('[Setup] Codex verification result:', { authenticated });

      res.json({
        success: true,
        authenticated: authenticated.success,
        error: authenticated.error,
      });
    } catch (error) {
      logger.error('[Setup] Verify Codex auth endpoint error:', error);
      res.status(500).json({
        success: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      });
    }
  };
}

async function runTestQuery(
  cliPath: string,
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Verification timed out after 30 seconds' });
    }, 30000);

    const env = { ...process.env };
    if (apiKey) {
      env.OPENAI_API_KEY = apiKey;
    }

    // Run codex exec with a simple prompt for non-interactive verification
    // Use gpt-5.1-codex-mini model for fast verification
    const args = ['exec', '-m', 'gpt-5.1-codex-mini', "Reply with only the word 'ok'"];

    logger.info(`[Setup] Running: ${cliPath} ${args.join(' ')}`);

    const child = spawn(cliPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      logger.info('[Setup] Codex stdout:', text.substring(0, 200));
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      logger.info('[Setup] Codex stderr:', text.substring(0, 200));
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      logger.error('[Setup] Codex process error:', error);
      resolve({ success: false, error: error.message });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      const output = stdout + stderr;

      logger.info('[Setup] Codex process closed with code:', code);

      // Check for auth errors first
      if (containsAuthError(output)) {
        resolve({
          success: false,
          error: 'Authentication failed. Please check your OpenAI API key or run "codex login".',
        });
        return;
      }

      // Check for rate limits
      if (isRateLimitError(output)) {
        resolve({
          success: false,
          error: 'Rate limit reached. Please wait a while before trying again.',
        });
        return;
      }

      // If we got a "model not supported" error, authentication actually worked!
      // This happens with ChatGPT account credentials which have model restrictions
      if (isModelNotSupported(output)) {
        logger.info('[Setup] Model not supported but authentication succeeded');
        resolve({ success: true });
        return;
      }

      // Check exit code - code 0 means success
      if (code === 0) {
        resolve({ success: true });
        return;
      }

      // Non-zero exit but might still have worked if we got output
      if (stdout.length > 10) {
        resolve({ success: true });
        return;
      }

      resolve({
        success: false,
        error: stderr || 'Verification failed. Please check your Codex CLI installation.',
      });
    });

    // Send empty input and close stdin
    child.stdin?.end();
  });
}
