import { spawn } from 'child_process';
import * as os from 'os';
import * as pty from 'node-pty';

/**
 * Codex Usage Service
 *
 * Tracks usage data for OpenAI Codex CLI usage.
 * This service attempts to gather usage information from various sources:
 * 1. Codex CLI if it provides usage commands
 * 2. OpenAI API direct calls for usage data
 * 3. Local tracking of token usage
 *
 * Unlike Claude CLI which has a dedicated /usage command, OpenAI's usage
 * tracking typically requires API calls to their usage endpoints.
 */
export class CodexUsageService {
  private codexBinary = 'codex';
  private timeout = 30000; // 30 second timeout
  private isWindows = os.platform() === 'win32';
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Check if Codex CLI is available on the system
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCmd = this.isWindows ? 'where' : 'which';
      const proc = spawn(checkCmd, [this.codexBinary]);
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Check if authentication is available (API key or stored auth)
   */
  async isAuthenticated(): Promise<boolean> {
    // Check for environment variable API key
    if (this.apiKey) {
      return true;
    }

    // Check for stored auth in codex CLI config
    try {
      const authCheck = await this.executeCodexCommand(['auth', 'status']);
      return !authCheck.includes('not authenticated') && !authCheck.includes('error');
    } catch {
      return false;
    }
  }

  /**
   * Fetch usage data for Codex/OpenAI
   * Since OpenAI doesn't have a simple CLI usage command like Claude,
   * we'll provide a structure similar to Claude but with appropriate defaults
   */
  async fetchUsageData(): Promise<CodexUsage> {
    // Try to get usage information from various sources
    let usageInfo: Partial<CodexUsage> = {};

    // Attempt 1: Check if codex CLI has usage commands
    try {
      await this.tryGetCodexUsage(usageInfo);
    } catch (error) {
      console.log('[CodexUsageService] Codex CLI usage not available:', error);
    }

    // Attempt 2: Try to get OpenAI API usage (requires API implementation)
    try {
      await this.tryGetOpenAIUsage(usageInfo);
    } catch (error) {
      console.log('[CodexUsageService] OpenAI API usage not available:', error);
    }

    // If no authentication is available, throw an error
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error(
        "Authentication required - please set OPENAI_API_KEY environment variable or run 'codex login'"
      );
    }

    // Return structure with any real data we managed to collect, or defaults
    return {
      // Daily usage (OpenAI typically tracks daily, not session)
      dailyTokensUsed: usageInfo.dailyTokensUsed ?? 0,
      dailyLimit: usageInfo.dailyLimit ?? 0,
      dailyPercentage: usageInfo.dailyPercentage ?? 0,
      dailyResetTime: usageInfo.dailyResetTime ?? this.getNextDayResetTime(),
      dailyResetText: usageInfo.dailyResetText ?? 'Resets daily at midnight UTC',

      // Monthly usage (OpenAI billing cycle)
      monthlyTokensUsed: usageInfo.monthlyTokensUsed ?? 0,
      monthlyLimit: usageInfo.monthlyLimit ?? 0,
      monthlyPercentage: usageInfo.monthlyPercentage ?? 0,
      monthlyResetTime: usageInfo.monthlyResetTime ?? this.getNextMonthResetTime(),
      monthlyResetText: usageInfo.monthlyResetText ?? 'Resets monthly on billing date',

      // Cost information
      costUsed: usageInfo.costUsed ?? null,
      costLimit: usageInfo.costLimit ?? null,
      costCurrency: usageInfo.costCurrency ?? 'USD',

      // Request rate limits (OpenAI has RPM limits)
      requestsUsed: usageInfo.requestsUsed ?? 0,
      requestsLimit: usageInfo.requestsLimit ?? 0,
      requestsPercentage: usageInfo.requestsPercentage ?? 0,
      requestsResetTime: usageInfo.requestsResetTime ?? this.getNextMinuteResetTime(),
      requestsResetText: usageInfo.requestsResetText ?? 'Resets every minute',

      lastUpdated: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      authenticationRequired: !isAuthenticated,
    };
  }

  /**
   * Try to get usage from Codex CLI if it supports usage commands
   */
  private async tryGetCodexUsage(usageInfo: Partial<CodexUsage>): Promise<void> {
    try {
      // Check if codex has any usage-related commands
      const helpOutput = await this.executeCodexCommand(['--help']);

      if (helpOutput.includes('usage') || helpOutput.includes('limits')) {
        // Try common usage command patterns
        const commands = ['usage', 'limits', 'status --usage'];

        for (const cmd of commands) {
          try {
            const output = await this.executeCodexCommand(cmd.split(' '));
            if (output.includes('tokens') || output.includes('usage') || output.includes('limit')) {
              this.parseCodexUsageOutput(output, usageInfo);
              break;
            }
          } catch {
            // Command not available, try next
          }
        }
      }
    } catch (error) {
      console.log('[CodexUsageService] Codex CLI usage check failed:', error);
    }
  }

  /**
   * Try to get usage from OpenAI API directly
   * Note: This would require implementing OpenAI API calls
   */
  private async tryGetOpenAIUsage(usageInfo: Partial<CodexUsage>): Promise<void> {
    if (!this.apiKey) {
      throw new Error('No OpenAI API key available');
    }

    // TODO: Implement OpenAI API usage calls when available
    // OpenAI API typically provides usage data through:
    // - GET /v1/usage (for billing usage)
    // - Rate limit headers in responses
    // - Account dashboard data

    console.log('[CodexUsageService] OpenAI API usage tracking not yet implemented');
  }

  /**
   * Execute a codex command and return output
   */
  private async executeCodexCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(this.codexBinary, args, {
        env: {
          ...process.env,
          OPENAI_API_KEY: this.apiKey || '',
        },
      });

      const timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error('Command timed out'));
      }, this.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  /**
   * Parse Codex CLI output for usage information
   */
  private parseCodexUsageOutput(output: string, usageInfo: Partial<CodexUsage>): void {
    const lines = output.split('\n').map((l) => l.trim());

    for (const line of lines) {
      // Look for token usage patterns
      if (line.includes('tokens') && line.includes('/')) {
        const tokenMatch = line.match(/(\d+)\s*\/\s*(\d+)\s*tokens?/i);
        if (tokenMatch) {
          const used = parseInt(tokenMatch[1], 10);
          const limit = parseInt(tokenMatch[2], 10);
          usageInfo.dailyTokensUsed = used;
          usageInfo.dailyLimit = limit;
          usageInfo.dailyPercentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
        }
      }

      // Look for request patterns
      if (line.includes('requests') && line.includes('/')) {
        const requestMatch = line.match(/(\d+)\s*\/\s*(\d+)\s*requests?/i);
        if (requestMatch) {
          const used = parseInt(requestMatch[1], 10);
          const limit = parseInt(requestMatch[2], 10);
          usageInfo.requestsUsed = used;
          usageInfo.requestsLimit = limit;
          usageInfo.requestsPercentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
        }
      }

      // Look for cost information
      if (line.includes('$') || line.includes('cost')) {
        const costMatch = line.match(/\$?([\d.]+)/);
        if (costMatch) {
          usageInfo.costUsed = parseFloat(costMatch[1]);
          usageInfo.costCurrency = 'USD';
        }
      }
    }
  }

  /**
   * Get the next day reset time (midnight UTC)
   */
  private getNextDayResetTime(): string {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    return nextDay.toISOString();
  }

  /**
   * Get the next month reset time (first day of next month)
   */
  private getNextMonthResetTime(): string {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth.toISOString();
  }

  /**
   * Get the next minute reset time (for rate limits)
   */
  private getNextMinuteResetTime(): string {
    const now = new Date();
    const nextMinute = new Date(now);
    nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1);
    nextMinute.setUTCSeconds(0, 0);
    return nextMinute.toISOString();
  }
}

/**
 * Codex Usage type definition
 */
export type CodexUsage = {
  // Daily usage tracking (OpenAI typically uses daily limits)
  dailyTokensUsed: number;
  dailyLimit: number;
  dailyPercentage: number;
  dailyResetTime: string; // ISO date string
  dailyResetText: string; // Raw text like "Resets daily at midnight UTC"

  // Monthly usage tracking (OpenAI billing cycle)
  monthlyTokensUsed: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  monthlyResetTime: string; // ISO date string
  monthlyResetText: string; // Raw text like "Resets monthly on billing date"

  // Cost information
  costUsed: number | null;
  costLimit: number | null;
  costCurrency: string | null;

  // Request rate limits (OpenAI RPM limits)
  requestsUsed: number;
  requestsLimit: number;
  requestsPercentage: number;
  requestsResetTime: string; // ISO date string
  requestsResetText: string; // Raw text like "Resets every minute"

  lastUpdated: string; // ISO date string
  userTimezone: string;
  authenticationRequired: boolean;
};

/**
 * Codex Status type definition (similar to Claude)
 */
export type CodexStatus = {
  indicator: {
    color: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  };
  description: string;
};
