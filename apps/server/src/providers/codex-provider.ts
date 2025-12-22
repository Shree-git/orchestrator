/**
 * Codex Provider - Executes queries using OpenAI Codex CLI
 *
 * Spawns the `codex` CLI as a subprocess and parses JSONL output
 * to integrate with the provider architecture.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import readline from 'readline';
import { BaseProvider } from './base-provider.js';
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
  ContentBlock,
  ConversationMessage,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Codex CLI JSONL event types
 */
interface CodexEvent {
  type: string;
  item?: {
    type?: string;
    id?: string;
    text?: string; // Direct text field for agent_message and reasoning
    content?: Array<{
      type: string;
      text?: string;
      annotations?: unknown[];
    }>;
    role?: string;
    status?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    output?: string;
  };
  response?: {
    id?: string;
    status?: string;
  };
  error?: {
    message?: string;
    code?: string;
  };
  thread_id?: string; // For thread.started events
  usage?: {
    // For turn.completed events
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

export class CodexProvider extends BaseProvider {
  private cliPath: string | null = null;

  getName(): string {
    return 'codex';
  }

  /**
   * Execute a query using Codex CLI
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    const { prompt, model, cwd, systemPrompt, abortController, conversationHistory } = options;

    // Find codex CLI path
    const cliPath = await this.findCliPath();
    if (!cliPath) {
      yield {
        type: 'error',
        error: 'Codex CLI not found. Please install it using: npm install -g @openai/codex',
      };
      return;
    }

    // Build combined prompt with history
    let combinedPrompt = '';

    // Add conversation history as context if available
    if (conversationHistory && conversationHistory.length > 0) {
      combinedPrompt += this.formatHistoryAsText(conversationHistory);
      combinedPrompt += '\nCurrent request:\n';
    }

    // Add the actual prompt
    if (Array.isArray(prompt)) {
      // Extract text from multipart prompt
      for (const part of prompt) {
        if (part.type === 'text' && part.text) {
          combinedPrompt += part.text;
        }
      }
    } else {
      combinedPrompt = combinedPrompt + prompt;
    }

    // Build command arguments
    const args = ['exec'];

    // Add model
    args.push('--model', model);

    // Add JSON output format
    args.push('--json');

    // Add full-auto mode for autonomous operation
    args.push('--full-auto');

    // Add system prompt if provided
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Add the prompt
    args.push(combinedPrompt);

    console.log(`[CodexProvider] Spawning: ${cliPath} ${args.join(' ')}`);
    console.log(`[CodexProvider] Working directory: ${cwd}`);

    // Spawn the codex process
    const codexProcess = spawn(cliPath, args, {
      cwd,
      env: {
        ...process.env,
        // Ensure OPENAI_API_KEY is available if set
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    console.log(`[CodexProvider] Process spawned with PID: ${codexProcess.pid}`);

    // Handle abort signal
    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        console.log('[CodexProvider] Abort signal received, killing process');
        codexProcess.kill('SIGTERM');
      });
    }

    // Create readline interface for stdout JSONL parsing
    const rl = readline.createInterface({
      input: codexProcess.stdout,
      crlfDelay: Infinity,
    });

    // Collect stderr for error reporting
    let stderrOutput = '';
    codexProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      console.error(`[CodexProvider] stderr: ${data.toString()}`);
    });

    // Track if we've yielded any messages
    let hasYieldedMessage = false;
    let lineCount = 0;

    // Process JSONL lines
    console.log('[CodexProvider] Starting to read stdout lines...');
    try {
      for await (const line of rl) {
        lineCount++;
        console.log(`[CodexProvider] Received line #${lineCount}: ${line.substring(0, 100)}...`);

        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as CodexEvent;
          console.log(`[CodexProvider] Parsed event type: ${event.type}`);
          const messages = this.convertEventToMessages(event);
          console.log(`[CodexProvider] Converted to ${messages.length} message(s)`);

          for (const msg of messages) {
            hasYieldedMessage = true;
            console.log(`[CodexProvider] Yielding message type: ${msg.type}`);
            yield msg;
          }
        } catch (parseError) {
          console.error('[CodexProvider] Failed to parse JSONL line:', line);
          // Continue processing other lines
        }
      }
      console.log(`[CodexProvider] Finished reading stdout. Total lines: ${lineCount}`);

      // Wait for process to exit
      await new Promise<void>((resolve, reject) => {
        codexProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else if (code === null) {
            // Process was killed (e.g., by abort)
            resolve();
          } else {
            reject(new Error(`Codex CLI exited with code ${code}: ${stderrOutput}`));
          }
        });

        codexProcess.on('error', (error) => {
          reject(error);
        });
      });

      // If we haven't yielded any messages, yield a success result
      if (!hasYieldedMessage) {
        yield {
          type: 'result',
          subtype: 'success',
          result: 'Codex execution completed',
        };
      }
    } catch (error) {
      console.error('[CodexProvider] Error during execution:', error);
      yield {
        type: 'error',
        error: (error as Error).message || 'Unknown error during Codex execution',
      };
    }
  }

  /**
   * Convert Codex JSONL event to ProviderMessage format
   */
  private convertEventToMessages(event: CodexEvent): ProviderMessage[] {
    const messages: ProviderMessage[] = [];

    switch (event.type) {
      case 'message.created':
      case 'message.updated':
      case 'message.completed': {
        if (event.item?.role === 'assistant' && event.item.content) {
          const content: ContentBlock[] = [];

          for (const block of event.item.content) {
            if (block.type === 'text' && block.text) {
              content.push({
                type: 'text',
                text: block.text,
              });
            } else if (block.type === 'reasoning' && block.text) {
              content.push({
                type: 'thinking',
                thinking: block.text,
              });
            }
          }

          if (content.length > 0) {
            messages.push({
              type: 'assistant',
              message: {
                role: 'assistant',
                content,
              },
            });
          }
        }
        break;
      }

      case 'function_call.created':
      case 'function_call.updated': {
        if (event.item?.name) {
          messages.push({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  name: event.item.name,
                  input: event.item.arguments ? JSON.parse(event.item.arguments) : {},
                  tool_use_id: event.item.call_id || event.item.id,
                },
              ],
            },
          });
        }
        break;
      }

      case 'function_call.completed': {
        if (event.item?.output) {
          messages.push({
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: event.item.call_id || event.item.id,
                  content: event.item.output,
                },
              ],
            },
          });
        }
        break;
      }

      case 'response.completed': {
        messages.push({
          type: 'result',
          subtype: 'success',
          result: 'Codex execution completed successfully',
        });
        break;
      }

      case 'response.failed':
      case 'error': {
        messages.push({
          type: 'error',
          error: event.error?.message || 'Unknown error from Codex',
        });
        break;
      }

      // Handle item-based events (alternative format)
      case 'item.started':
      case 'item.created':
      case 'item.updated':
      case 'item.completed': {
        const item = event.item;
        if (!item) break;

        // Handle agent_message type (primary text response)
        if ((item.type === 'agent_message' || item.type === 'message') && item.text) {
          messages.push({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: item.text }],
            },
          });
        }
        // Handle message with content array (legacy format)
        else if (item.type === 'message' && item.role === 'assistant' && item.content) {
          const content: ContentBlock[] = [];
          for (const block of item.content) {
            if (block.type === 'text' && block.text) {
              content.push({ type: 'text', text: block.text });
            }
          }
          if (content.length > 0) {
            messages.push({
              type: 'assistant',
              message: { role: 'assistant', content },
            });
          }
        }
        // Handle reasoning (thinking) type
        else if (item.type === 'reasoning' && item.text) {
          messages.push({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'thinking', thinking: item.text }],
            },
          });
        }
        // Handle reasoning with content array (legacy format)
        else if (item.type === 'reasoning' && item.content) {
          for (const block of item.content) {
            if (block.text) {
              messages.push({
                type: 'assistant',
                message: {
                  role: 'assistant',
                  content: [{ type: 'thinking', thinking: block.text }],
                },
              });
            }
          }
        } else if (item.type === 'function_call') {
          messages.push({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  name: item.name || 'unknown',
                  input: item.arguments ? JSON.parse(item.arguments) : {},
                  tool_use_id: item.call_id || item.id,
                },
              ],
            },
          });
        } else if (item.type === 'function_call_output') {
          messages.push({
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: item.call_id,
                  content: item.output || '',
                },
              ],
            },
          });
        }
        break;
      }

      case 'thread.started':
      case 'turn.started':
      case 'turn.completed':
        // These events are informational and don't require messages
        break;

      case 'thread.completed': {
        messages.push({
          type: 'result',
          subtype: 'success',
          result: 'Thread completed',
        });
        break;
      }

      default:
        // Log unknown event types for debugging
        console.log(`[CodexProvider] Unknown event type: ${event.type}`);
    }

    return messages;
  }

  /**
   * Format conversation history as text for CLI context
   */
  private formatHistoryAsText(history: ConversationMessage[]): string {
    let text = '=== Previous Conversation ===\n\n';

    for (const msg of history) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      let content = '';

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .map((part) => {
            if (part.type === 'text' && part.text) {
              return part.text;
            }
            return '';
          })
          .join('\n');
      }

      text += `${role}:\n${content}\n\n`;
    }

    text += '=== End Previous Conversation ===\n\n';
    return text;
  }

  /**
   * Find the codex CLI path
   */
  private async findCliPath(): Promise<string | null> {
    if (this.cliPath) {
      return this.cliPath;
    }

    const isWindows = process.platform === 'win32';

    // Try 'which' or 'where' first
    try {
      const findCommand = isWindows ? 'where codex' : 'which codex';
      const { stdout } = await execAsync(findCommand);
      const foundPath = stdout.trim().split(/\r?\n/)[0];
      if (foundPath) {
        this.cliPath = foundPath;
        return foundPath;
      }
    } catch {
      // Not in PATH
    }

    // Try common installation paths
    const commonPaths = isWindows
      ? [
          path.join(os.homedir(), '.local', 'bin', 'codex.exe'),
          path.join(process.env.APPDATA || '', 'npm', 'codex.cmd'),
          path.join(process.env.APPDATA || '', 'npm', 'codex'),
        ]
      : [
          path.join(os.homedir(), '.local', 'bin', 'codex'),
          '/usr/local/bin/codex',
          '/opt/homebrew/bin/codex',
          path.join(os.homedir(), '.npm-global', 'bin', 'codex'),
        ];

    for (const p of commonPaths) {
      try {
        await fs.access(p);
        this.cliPath = p;
        return p;
      } catch {
        // Not found at this path
      }
    }

    return null;
  }

  /**
   * Detect Codex CLI installation
   */
  async detectInstallation(): Promise<InstallationStatus> {
    const cliPath = await this.findCliPath();

    if (!cliPath) {
      return {
        installed: false,
        method: 'cli',
        hasApiKey: !!process.env.OPENAI_API_KEY,
        authenticated: false,
        error: 'Codex CLI not found',
      };
    }

    // Get version
    let version = '';
    try {
      const { stdout } = await execAsync(`"${cliPath}" --version`);
      version = stdout.trim();
    } catch {
      // Version command might not be available
    }

    // Check authentication
    const hasEnvApiKey = !!process.env.OPENAI_API_KEY;
    let hasStoredAuth = false;

    // Check for codex auth file
    const codexAuthPath = path.join(os.homedir(), '.codex', 'auth.json');
    try {
      await fs.access(codexAuthPath);
      hasStoredAuth = true;
    } catch {
      // No auth file
    }

    const authenticated = hasEnvApiKey || hasStoredAuth;

    return {
      installed: true,
      path: cliPath,
      version,
      method: 'cli',
      hasApiKey: hasEnvApiKey,
      authenticated,
    };
  }

  /**
   * Get available Codex models
   */
  getAvailableModels(): ModelDefinition[] {
    return [
      {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        modelString: 'gpt-5.2-codex',
        provider: 'openai',
        description: 'Latest frontier agentic coding model',
        contextWindow: 200000,
        maxOutputTokens: 100000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
        default: true,
      },
      {
        id: 'gpt-5.1-codex-max',
        name: 'GPT-5.1 Codex Max',
        modelString: 'gpt-5.1-codex-max',
        provider: 'openai',
        description: 'Deep and fast reasoning flagship',
        contextWindow: 200000,
        maxOutputTokens: 100000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
      },
      {
        id: 'gpt-5.1-codex-mini',
        name: 'GPT-5.1 Codex Mini',
        modelString: 'gpt-5.1-codex-mini',
        provider: 'openai',
        description: 'Cheaper, faster, optimized for codex',
        contextWindow: 200000,
        maxOutputTokens: 32768,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        modelString: 'gpt-5.2',
        provider: 'openai',
        description: 'Latest frontier model for all tasks',
        contextWindow: 200000,
        maxOutputTokens: 100000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
      },
    ];
  }

  /**
   * Check if the provider supports a specific feature
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = ['tools', 'text', 'vision'];
    return supportedFeatures.includes(feature);
  }
}
