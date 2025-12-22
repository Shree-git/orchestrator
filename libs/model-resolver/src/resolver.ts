/**
 * Model resolution utilities for handling model string mapping
 *
 * Provides centralized model resolution logic:
 * - Maps Claude model aliases to full model strings
 * - Maps Codex model aliases to full model strings
 * - Provides default models per provider
 * - Handles multiple model sources with priority
 */

import { CLAUDE_MODEL_MAP, CODEX_MODEL_MAP, DEFAULT_MODELS } from '@automaker/types';

/**
 * Resolve a model key/alias to a full model string
 *
 * @param modelKey - Model key (e.g., "opus", "o3", "gpt-4.1", "claude-sonnet-4-20250514")
 * @param defaultModel - Fallback model if modelKey is undefined
 * @returns Full model string
 */
export function resolveModelString(
  modelKey?: string,
  defaultModel: string = DEFAULT_MODELS.claude
): string {
  // No model specified - use default
  if (!modelKey) {
    return defaultModel;
  }

  // Full Claude model string - pass through unchanged
  if (modelKey.includes('claude-')) {
    console.log(`[ModelResolver] Using full Claude model string: ${modelKey}`);
    return modelKey;
  }

  // Full Codex/OpenAI model string - pass through unchanged
  if (modelKey.startsWith('gpt-') || modelKey.startsWith('codex-')) {
    console.log(`[ModelResolver] Using full Codex/OpenAI model string: ${modelKey}`);
    return modelKey;
  }

  // Look up Claude model alias
  const claudeResolved = CLAUDE_MODEL_MAP[modelKey];
  if (claudeResolved) {
    console.log(
      `[ModelResolver] Resolved Claude model alias: "${modelKey}" -> "${claudeResolved}"`
    );
    return claudeResolved;
  }

  // Look up Codex model alias
  const codexResolved = CODEX_MODEL_MAP[modelKey];
  if (codexResolved) {
    console.log(`[ModelResolver] Resolved Codex model alias: "${modelKey}" -> "${codexResolved}"`);
    return codexResolved;
  }

  // Unknown model key - use default
  console.warn(`[ModelResolver] Unknown model key "${modelKey}", using default: "${defaultModel}"`);
  return defaultModel;
}

/**
 * Get the effective model from multiple sources
 * Priority: explicit model > session model > default
 *
 * @param explicitModel - Explicitly provided model (highest priority)
 * @param sessionModel - Model from session (medium priority)
 * @param defaultModel - Fallback default model (lowest priority)
 * @returns Resolved model string
 */
export function getEffectiveModel(
  explicitModel?: string,
  sessionModel?: string,
  defaultModel?: string
): string {
  return resolveModelString(explicitModel || sessionModel, defaultModel);
}
