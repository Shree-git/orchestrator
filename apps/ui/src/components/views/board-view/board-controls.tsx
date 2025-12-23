import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ImageIcon,
  Archive,
  Minimize2,
  Square,
  Maximize2,
  CheckSquare,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardControlsProps {
  isMounted: boolean;
  onShowBoardBackground: () => void;
  onShowCompletedModal: () => void;
  completedCount: number;
  kanbanCardDetailLevel: 'minimal' | 'standard' | 'detailed';
  onDetailLevelChange: (level: 'minimal' | 'standard' | 'detailed') => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  onBatchDelete: () => void;
}

export function BoardControls({
  isMounted,
  onShowBoardBackground,
  onShowCompletedModal,
  completedCount,
  kanbanCardDetailLevel,
  onDetailLevelChange,
  isSelectionMode,
  onToggleSelectionMode,
  selectedCount,
  onBatchDelete,
}: BoardControlsProps) {
  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 ml-4">
        {/* Board Background Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onShowBoardBackground}
              className="h-8 px-2"
              data-testid="board-background-button"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Board Background Settings</p>
          </TooltipContent>
        </Tooltip>

        {/* Completed/Archived Features Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onShowCompletedModal}
              className="h-8 px-2 relative"
              data-testid="completed-features-button"
            >
              <Archive className="w-4 h-4" />
              {completedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {completedCount > 99 ? '99+' : completedCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Completed Features ({completedCount})</p>
          </TooltipContent>
        </Tooltip>

        {/* Selection Mode Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isSelectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleSelectionMode}
              className={cn(
                'h-8 px-3 relative gap-1.5',
                isSelectionMode && 'bg-brand-500 hover:bg-brand-600 text-white'
              )}
              data-testid="selection-mode-button"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="text-xs font-medium">
                {isSelectionMode ? 'Exit Select' : 'Select'}
              </span>
              {isSelectionMode && selectedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-brand-500 text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                  {selectedCount > 99 ? '99+' : selectedCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isSelectionMode
                ? `Selection Mode (${selectedCount} selected)`
                : 'Enable Selection Mode'}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Batch Delete Button - Only shown when in selection mode with items selected */}
        {isSelectionMode && selectedCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={onBatchDelete}
                className="h-8 px-3 gap-1.5"
                data-testid="batch-delete-button"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium">Delete ({selectedCount})</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Delete {selectedCount} selected feature{selectedCount !== 1 ? 's' : ''}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Kanban Card Detail Level Toggle */}
        <div
          className="flex items-center rounded-lg bg-secondary border border-border"
          data-testid="kanban-detail-toggle"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDetailLevelChange('minimal')}
                className={cn(
                  'p-2 rounded-l-lg transition-colors',
                  kanbanCardDetailLevel === 'minimal'
                    ? 'bg-brand-500/20 text-brand-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                data-testid="kanban-toggle-minimal"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Minimal - Title & category only</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDetailLevelChange('standard')}
                className={cn(
                  'p-2 transition-colors',
                  kanbanCardDetailLevel === 'standard'
                    ? 'bg-brand-500/20 text-brand-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                data-testid="kanban-toggle-standard"
              >
                <Square className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Standard - Steps & progress</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDetailLevelChange('detailed')}
                className={cn(
                  'p-2 rounded-r-lg transition-colors',
                  kanbanCardDetailLevel === 'detailed'
                    ? 'bg-brand-500/20 text-brand-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                data-testid="kanban-toggle-detailed"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Detailed - Model, tools & tasks</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
