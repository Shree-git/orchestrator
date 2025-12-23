import { memo, useCallback, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { ReactNode } from 'react';

interface KanbanColumnProps {
  id: string;
  title: string;
  colorClass: string;
  count: number;
  children: ReactNode;
  headerAction?: ReactNode;
  opacity?: number;
  showBorder?: boolean;
  hideScrollbar?: boolean;
  /** Custom width in pixels. If not provided, defaults to 288px (w-72) */
  width?: number;
  /** Array of feature IDs in this column (for batch selection) */
  featureIds?: string[];
  /** Whether batch selection mode is active */
  isSelectionMode?: boolean;
  /** Array of currently selected feature IDs */
  selectedFeatureIds?: string[];
  /** Callback to select all features in this column */
  onSelectAll?: (featureIds: string[]) => void;
  /** Callback to deselect all features in this column */
  onDeselectAll?: (featureIds: string[]) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  id,
  title,
  colorClass,
  count,
  children,
  headerAction,
  opacity = 100,
  showBorder = true,
  hideScrollbar = false,
  width,
  featureIds = [],
  isSelectionMode = false,
  selectedFeatureIds = [],
  onSelectAll,
  onDeselectAll,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Calculate selection state for this column
  const columnSelectionState = useMemo(() => {
    if (!isSelectionMode || featureIds.length === 0) {
      return { allSelected: false, someSelected: false, noneSelected: true };
    }
    const selectedInColumn = featureIds.filter((fid) => selectedFeatureIds.includes(fid));
    const allSelected = selectedInColumn.length === featureIds.length;
    const someSelected = selectedInColumn.length > 0 && !allSelected;
    const noneSelected = selectedInColumn.length === 0;
    return { allSelected, someSelected, noneSelected };
  }, [isSelectionMode, featureIds, selectedFeatureIds]);

  const handleSelectAllChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        onSelectAll?.(featureIds);
      } else {
        onDeselectAll?.(featureIds);
      }
    },
    [featureIds, onSelectAll, onDeselectAll]
  );

  // Use inline style for width if provided, otherwise use default w-72
  const widthStyle = width ? { width: `${width}px`, flexShrink: 0 } : undefined;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex flex-col h-full rounded-xl transition-all duration-200',
        !width && 'w-72', // Only apply w-72 if no custom width
        showBorder && 'border border-border/60',
        isOver && 'ring-2 ring-primary/30 ring-offset-1 ring-offset-background'
      )}
      style={widthStyle}
      data-testid={`kanban-column-${id}`}
    >
      {/* Background layer with opacity */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl backdrop-blur-sm transition-colors duration-200',
          isOver ? 'bg-accent/80' : 'bg-card/80'
        )}
        style={{ opacity: opacity / 100 }}
      />

      {/* Column Header */}
      <div
        className={cn(
          'relative z-10 flex items-center gap-3 px-3 py-2.5',
          showBorder && 'border-b border-border/40'
        )}
      >
        {/* Select All Checkbox - only shown in selection mode with features */}
        {isSelectionMode && featureIds.length > 0 && (
          <Checkbox
            checked={columnSelectionState.allSelected}
            ref={(el) => {
              // Set indeterminate state via DOM since Radix doesn't support it directly
              if (el) {
                const input = el.querySelector('button');
                if (input) {
                  (input as HTMLButtonElement).dataset.state = columnSelectionState.someSelected
                    ? 'indeterminate'
                    : columnSelectionState.allSelected
                      ? 'checked'
                      : 'unchecked';
                }
              }
            }}
            onCheckedChange={handleSelectAllChange}
            className={cn(
              'h-4 w-4 rounded border-2 shrink-0',
              'bg-background/90 backdrop-blur-sm',
              'transition-all duration-150',
              columnSelectionState.allSelected && 'bg-primary border-primary',
              columnSelectionState.someSelected && 'bg-primary/50 border-primary'
            )}
            aria-label={`Select all features in ${title} column`}
            data-testid={`column-select-all-${id}`}
          />
        )}
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', colorClass)} />
        <h3 className="font-semibold text-sm text-foreground/90 flex-1 tracking-tight">{title}</h3>
        {headerAction}
        <span className="text-xs font-medium text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-md tabular-nums">
          {count}
        </span>
      </div>

      {/* Column Content */}
      <div
        className={cn(
          'relative z-10 flex-1 overflow-y-auto p-2 space-y-2.5',
          hideScrollbar &&
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          // Smooth scrolling
          'scroll-smooth'
        )}
      >
        {children}
      </div>

      {/* Drop zone indicator when dragging over */}
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/5 pointer-events-none z-5 border-2 border-dashed border-primary/20" />
      )}
    </div>
  );
});
