import type { AgentModel, ModelProvider, CodexModel } from '@/store/app-store';

const CODEX_MODELS: CodexModel[] = [
  'gpt-5.2-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
];

// Helper to determine provider from model
export function getProviderFromModel(model: AgentModel): ModelProvider {
  if (CODEX_MODELS.includes(model as CodexModel)) {
    return 'openai';
  }
  return 'claude';
}
