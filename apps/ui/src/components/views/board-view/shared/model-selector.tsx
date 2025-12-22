import { Label } from '@/components/ui/label';
import { Brain, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentModel } from '@/store/app-store';
import { CLAUDE_MODELS, CODEX_MODELS, ModelOption } from './model-constants';

interface ModelSelectorProps {
  selectedModel: AgentModel;
  onModelSelect: (model: AgentModel) => void;
  testIdPrefix?: string;
  showCodex?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  testIdPrefix = 'model-select',
  showCodex = true,
}: ModelSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Claude Models */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Claude (SDK)
          </Label>
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-primary/40 text-primary">
            Native
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {CLAUDE_MODELS.map((option) => {
            const isSelected = selectedModel === option.id;
            const shortName = option.label.replace('Claude ', '');
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onModelSelect(option.id)}
                title={option.description}
                className={cn(
                  'flex-1 min-w-[80px] px-3 py-2 rounded-md border text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input'
                )}
                data-testid={`${testIdPrefix}-${option.id}`}
              >
                {shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Codex Models */}
      {showCodex && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-green-500" />
              OpenAI Codex (CLI)
            </Label>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-green-500/40 text-green-500">
              CLI
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CODEX_MODELS.map((option) => {
              const isSelected = selectedModel === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onModelSelect(option.id)}
                  title={option.description}
                  className={cn(
                    'flex-1 min-w-[80px] px-3 py-2 rounded-md border text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-background hover:bg-accent border-input'
                  )}
                  data-testid={`${testIdPrefix}-${option.id}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
