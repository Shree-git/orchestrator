import type { AgentModel, ModelProvider } from '@/store/app-store';

// Helper to determine provider from model
export function getProviderFromModel(model: AgentModel): ModelProvider {
  return 'claude';
}
