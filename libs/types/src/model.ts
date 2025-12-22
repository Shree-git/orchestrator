/**
 * Model alias mapping for Claude models
 */
export const CLAUDE_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
} as const;

/**
 * Model alias mapping for Codex/OpenAI models
 */
export const CODEX_MODEL_MAP: Record<string, string> = {
  'gpt-5.2-codex': 'gpt-5.2-codex',
  'gpt-5.1-codex-max': 'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini': 'gpt-5.1-codex-mini',
  'gpt-5.2': 'gpt-5.2',
} as const;

/**
 * Default models per provider
 */
export const DEFAULT_MODELS = {
  claude: 'claude-opus-4-5-20251101',
  codex: 'gpt-5.2-codex',
} as const;

export type ClaudeModelAlias = keyof typeof CLAUDE_MODEL_MAP;
export type CodexModelAlias = keyof typeof CODEX_MODEL_MAP;

/**
 * ModelAlias - All model aliases across providers
 */
export type ModelAlias = ClaudeModelAlias | CodexModelAlias;

/**
 * AgentModel - Alias for ModelAlias for backward compatibility
 * Represents available models across all providers
 */
export type AgentModel = ModelAlias;

/**
 * Model provider types
 */
export type ModelProvider = 'claude' | 'openai';
