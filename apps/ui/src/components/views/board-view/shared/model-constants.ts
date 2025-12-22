import type { AgentModel, ThinkingLevel, ModelProvider } from '@/store/app-store';
import { Brain, Zap, Scale, Cpu, Rocket, Sparkles } from 'lucide-react';

export type ModelOption = {
  id: AgentModel;
  label: string;
  description: string;
  badge?: string;
  provider: ModelProvider;
};

export const CLAUDE_MODELS: ModelOption[] = [
  {
    id: 'haiku',
    label: 'Claude Haiku',
    description: 'Fast and efficient for simple tasks.',
    badge: 'Speed',
    provider: 'claude',
  },
  {
    id: 'sonnet',
    label: 'Claude Sonnet',
    description: 'Balanced performance with strong reasoning.',
    badge: 'Balanced',
    provider: 'claude',
  },
  {
    id: 'opus',
    label: 'Claude Opus',
    description: 'Most capable model for complex work.',
    badge: 'Premium',
    provider: 'claude',
  },
];

export const CODEX_MODELS: ModelOption[] = [
  {
    id: 'gpt-5.2-codex',
    label: 'GPT-5.2 Codex',
    description: 'Latest frontier agentic coding model.',
    badge: 'Premium',
    provider: 'openai',
  },
  {
    id: 'gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max',
    description: 'Deep and fast reasoning flagship.',
    badge: 'Balanced',
    provider: 'openai',
  },
  {
    id: 'gpt-5.1-codex-mini',
    label: 'GPT-5.1 Codex Mini',
    description: 'Cheaper, faster, optimized for codex.',
    badge: 'Speed',
    provider: 'openai',
  },
  {
    id: 'gpt-5.2',
    label: 'GPT-5.2',
    description: 'Latest frontier model for all tasks.',
    badge: 'General',
    provider: 'openai',
  },
];

// All available models across providers
export const ALL_MODELS: ModelOption[] = [...CLAUDE_MODELS, ...CODEX_MODELS];

export const THINKING_LEVELS: ThinkingLevel[] = ['none', 'low', 'medium', 'high', 'ultrathink'];

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  ultrathink: 'Ultra',
};

// Profile icon mapping
export const PROFILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain,
  Zap,
  Scale,
  Cpu,
  Rocket,
  Sparkles,
};
