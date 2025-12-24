import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Feature } from '@/store/app-store';
import { Check, ChevronDown, Plus, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateDependencies } from '../utils/dependency-validation';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DependencySelectorProps {
  /** Current feature ID being edited */
  currentFeatureId: string;
  /** All available features */
  allFeatures: Feature[];
  /** Currently selected dependency IDs */
  selectedDependencies: string[];
  /** Callback when dependencies change */
  onDependenciesChange: (dependencies: string[]) => void;
  /** Test ID prefix for testing */
  testIdPrefix?: string;
}

export function DependencySelector({
  currentFeatureId,
  allFeatures,
  selectedDependencies,
  onDependenciesChange,
  testIdPrefix = 'dependency-selector',
}: DependencySelectorProps) {
  const [open, setOpen] = useState(false);

  // Get features that can be selected as dependencies
  const availableFeatures = useMemo(() => {
    return allFeatures.filter(
      (feature) =>
        // Don't show the current feature
        feature.id !== currentFeatureId &&
        // Don't show already selected dependencies
        !selectedDependencies.includes(feature.id) &&
        // Prefer showing completed or in-progress features
        (feature.status === 'completed' ||
          feature.status === 'verified' ||
          feature.status === 'in_progress' ||
          feature.status === 'waiting_approval' ||
          feature.status === 'backlog')
    );
  }, [allFeatures, currentFeatureId, selectedDependencies]);

  // Get selected dependency features for display
  const selectedFeatures = useMemo(() => {
    return selectedDependencies
      .map((id) => allFeatures.find((f) => f.id === id))
      .filter((f): f is Feature => f !== undefined);
  }, [selectedDependencies, allFeatures]);

  // Check for validation errors including circular dependencies
  const validationResult = useMemo(() => {
    return validateDependencies(currentFeatureId, selectedDependencies, allFeatures);
  }, [currentFeatureId, selectedDependencies, allFeatures]);

  const handleAddDependency = (featureId: string) => {
    const newDependencies = [...selectedDependencies, featureId];
    onDependenciesChange(newDependencies);
    setOpen(false);
  };

  const handleRemoveDependency = (featureId: string) => {
    const newDependencies = selectedDependencies.filter((id) => id !== featureId);
    onDependenciesChange(newDependencies);
  };

  const getStatusColor = (status: Feature['status']) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'in_progress':
      case 'waiting_approval':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'backlog':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-3">
      <Label>Dependencies</Label>
      <p className="text-sm text-muted-foreground">
        Select features that must be completed before this one can be started.
      </p>

      {/* Validation Errors */}
      {!validationResult.valid && validationResult.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validationResult.errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Selected Dependencies */}
      {selectedFeatures.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Selected Dependencies ({selectedFeatures.length})
          </Label>
          <ScrollArea className="max-h-32">
            <div className="space-y-2">
              {selectedFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between p-2 border rounded-lg bg-muted/30"
                  data-testid={`${testIdPrefix}-selected-${feature.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {feature.description.slice(0, 60)}
                        {feature.description.length > 60 && '...'}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs shrink-0', getStatusColor(feature.status))}
                      >
                        {feature.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {feature.category && (
                      <div className="text-xs text-muted-foreground mt-1">{feature.category}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDependency(feature.id)}
                    className="ml-2 h-6 w-6 p-0"
                    data-testid={`${testIdPrefix}-remove-${feature.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Add Dependency Button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start"
            data-testid={`${testIdPrefix}-trigger`}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Dependency
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search features..." data-testid={`${testIdPrefix}-search`} />
            <CommandList>
              <CommandEmpty>No features found.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="max-h-64">
                  {availableFeatures.map((feature) => (
                    <CommandItem
                      key={feature.id}
                      value={feature.id}
                      onSelect={() => handleAddDependency(feature.id)}
                      className="flex flex-col items-start gap-2 p-3"
                      data-testid={`${testIdPrefix}-option-${feature.id}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check
                            className={cn(
                              'h-4 w-4',
                              selectedDependencies.includes(feature.id)
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className="font-medium text-sm truncate">
                            {feature.description.slice(0, 50)}
                            {feature.description.length > 50 && '...'}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-xs shrink-0 ml-2', getStatusColor(feature.status))}
                        >
                          {feature.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {feature.category && (
                        <div className="text-xs text-muted-foreground pl-6">{feature.category}</div>
                      )}
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Dependencies determine execution order in the task queue</p>
        <p>• Circular dependencies are automatically detected and prevented</p>
        <p>• Completed features are preferred for stable dependency chains</p>
      </div>
    </div>
  );
}
