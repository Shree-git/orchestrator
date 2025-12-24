import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClaudeUsageCard } from './usage-view/claude-usage-card';
import { CodexUsageCard } from './usage-view/codex-usage-card';

export function UsageView() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    // TODO: Implement refresh logic for both Claude and Codex usage
    // This will be implemented in subsequent tasks
    setTimeout(() => setIsRefreshing(false), 1000); // Simulate refresh
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg" data-testid="usage-view">
      {/* Header Section */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Usage Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor your Claude and Codex API usage and limits
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Refresh All
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Claude Usage Section */}
          <div className="space-y-4">
            <ClaudeUsageCard />
          </div>

          {/* Codex Usage Section */}
          <div className="space-y-4">
            <CodexUsageCard />
          </div>

          {/* Additional Information */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-6">
            <h3 className="font-medium text-foreground mb-2">About Usage Tracking</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                This dashboard provides a centralized view of your API usage across both Claude and
                Codex providers.
              </p>
              <p>
                Usage data is automatically refreshed periodically to help you monitor your
                consumption and avoid hitting limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
