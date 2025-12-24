import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { useAppStore } from '@/store/app-store';

// Error codes for distinguishing failure modes
const ERROR_CODES = {
  API_BRIDGE_UNAVAILABLE: 'API_BRIDGE_UNAVAILABLE',
  AUTH_ERROR: 'AUTH_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

type UsageError = {
  code: ErrorCode;
  message: string;
};

// Fixed refresh interval (45 seconds)
const REFRESH_INTERVAL_SECONDS = 45;

export function ClaudeUsageCard() {
  const { claudeUsage, claudeUsageLastUpdated, setClaudeUsage } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UsageError | null>(null);

  // Check if data is stale (older than 2 minutes) - recalculates when claudeUsageLastUpdated changes
  const isStale = useMemo(() => {
    return !claudeUsageLastUpdated || Date.now() - claudeUsageLastUpdated > 2 * 60 * 1000;
  }, [claudeUsageLastUpdated]);

  const fetchUsage = useCallback(
    async (isAutoRefresh = false) => {
      if (!isAutoRefresh) setLoading(true);
      setError(null);
      try {
        const api = getElectronAPI();
        if (!api.claude) {
          setError({
            code: ERROR_CODES.API_BRIDGE_UNAVAILABLE,
            message: 'Claude API bridge not available',
          });
          return;
        }
        const data = await api.claude.getUsage();
        if ('error' in data) {
          // Safely extract error message
          let errorMessage = 'Authentication failed';

          if (data.message && typeof data.message === 'string') {
            errorMessage = data.message;
          } else if (data.error && typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (data.error && typeof data.error === 'object') {
            try {
              errorMessage = JSON.stringify(data.error);
            } catch (e) {
              errorMessage = 'Authentication failed';
            }
          }

          setError({
            code: ERROR_CODES.AUTH_ERROR,
            message: errorMessage,
          });
          return;
        }
        // Transform ClaudeUsageResponse to ClaudeUsage
        const claudeUsage = {
          sessionPercentage: data.sessionPercentage || 0,
          sessionResetText: data.sessionResetText || '',
          weeklyPercentage: data.weeklyPercentage || 0,
          weeklyResetText: data.weeklyResetText || '',
          sonnetWeeklyPercentage: data.sonnetWeeklyPercentage || 0,
          sonnetResetText: data.sonnetResetText || '',
          costUsed: data.costUsed,
          costLimit: data.costLimit,
          costCurrency: data.costCurrency,
          lastUpdated: new Date().toISOString(),
        };
        setClaudeUsage(claudeUsage);
      } catch (err) {
        let errorMessage = 'Failed to fetch usage';

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err === 'object') {
          try {
            errorMessage = JSON.stringify(err);
          } catch (e) {
            errorMessage = 'Failed to fetch usage';
          }
        }

        setError({
          code: ERROR_CODES.UNKNOWN,
          message: errorMessage,
        });
      } finally {
        if (!isAutoRefresh) setLoading(false);
      }
    },
    [setClaudeUsage]
  );

  // Auto-fetch on mount if data is stale
  useEffect(() => {
    if (isStale) {
      fetchUsage(true);
    }
  }, [isStale, fetchUsage]);

  // Auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchUsage(true);
    }, REFRESH_INTERVAL_SECONDS * 1000);

    return () => clearInterval(intervalId);
  }, [fetchUsage]);

  // Derived status color/icon helper
  const getStatusInfo = (percentage: number) => {
    if (percentage >= 75) return { color: 'text-red-500', icon: XCircle, bg: 'bg-red-500' };
    if (percentage >= 50)
      return { color: 'text-orange-500', icon: AlertTriangle, bg: 'bg-orange-500' };
    return { color: 'text-green-500', icon: CheckCircle, bg: 'bg-green-500' };
  };

  // Helper component for the progress bar
  const ProgressBar = ({ percentage, colorClass }: { percentage: number; colorClass: string }) => (
    <div className="h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden">
      <div
        className={cn('h-full transition-all duration-500', colorClass)}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );

  const UsageMetric = ({
    title,
    subtitle,
    percentage,
    resetText,
    isPrimary = false,
    stale = false,
  }: {
    title: string;
    subtitle: string;
    percentage: number;
    resetText?: string;
    isPrimary?: boolean;
    stale?: boolean;
  }) => {
    // Check if percentage is valid (not NaN, not undefined, is a finite number)
    const isValidPercentage =
      typeof percentage === 'number' && !isNaN(percentage) && isFinite(percentage);
    const safePercentage = isValidPercentage ? percentage : 0;

    const status = getStatusInfo(safePercentage);
    const StatusIcon = status.icon;

    return (
      <div
        className={cn(
          'rounded-xl border bg-card p-4 transition-opacity',
          isPrimary
            ? 'border-border/60 shadow-sm bg-gradient-to-br from-card via-card/95 to-card/90'
            : 'border-border/40 bg-card/80',
          (stale || !isValidPercentage) && 'opacity-60'
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className={cn('font-semibold', isPrimary ? 'text-base' : 'text-sm')}>{title}</h4>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {isValidPercentage ? (
            <div className="flex items-center gap-2">
              <StatusIcon className={cn('w-4 h-4', status.color)} />
              <span
                className={cn(
                  'font-mono font-bold',
                  status.color,
                  isPrimary ? 'text-lg' : 'text-base'
                )}
              >
                {Math.round(safePercentage)}%
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">N/A</span>
          )}
        </div>
        <ProgressBar
          percentage={safePercentage}
          colorClass={isValidPercentage ? status.bg : 'bg-muted-foreground/30'}
        />
        {resetText && (
          <div className="mt-3 flex justify-end">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {title === 'Session Usage' && <Clock className="w-3 h-3" />}
              {resetText}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/40 bg-gradient-to-r from-card/80 via-card/60 to-card/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/20">
            <Zap className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Claude Usage</h3>
            <p className="text-sm text-muted-foreground">Session and weekly usage limits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', loading && 'opacity-80')}
            onClick={() => !loading && fetchUsage(false)}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500/80" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{error.message}</p>
              <p className="text-xs text-muted-foreground max-w-md">
                {error.code === ERROR_CODES.API_BRIDGE_UNAVAILABLE ? (
                  'Ensure the Electron bridge is running or restart the app'
                ) : (
                  <>
                    Make sure Claude CLI is installed and authenticated via{' '}
                    <code className="font-mono bg-muted px-1 rounded">claude login</code>
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" onClick={() => fetchUsage(false)} className="gap-2 mt-4">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        ) : !claudeUsage ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Loading usage data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Session Usage */}
            <UsageMetric
              title="Session Usage"
              subtitle="5-hour rolling window"
              percentage={claudeUsage.sessionPercentage}
              resetText={claudeUsage.sessionResetText}
              isPrimary={true}
              stale={isStale}
            />

            {/* Secondary Usage Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UsageMetric
                title="Weekly Usage"
                subtitle="All models combined"
                percentage={claudeUsage.weeklyPercentage}
                resetText={claudeUsage.weeklyResetText}
                stale={isStale}
              />
              <UsageMetric
                title="Sonnet Weekly"
                subtitle="Claude-3.5-Sonnet only"
                percentage={claudeUsage.sonnetWeeklyPercentage}
                resetText={claudeUsage.sonnetResetText}
                stale={isStale}
              />
            </div>

            {/* Extra Usage / Cost */}
            {claudeUsage.costLimit && claudeUsage.costLimit > 0 && (
              <UsageMetric
                title="Extra Usage Cost"
                subtitle={`${claudeUsage.costUsed ?? 0} / ${claudeUsage.costLimit} ${claudeUsage.costCurrency ?? ''}`}
                percentage={
                  claudeUsage.costLimit > 0
                    ? ((claudeUsage.costUsed ?? 0) / claudeUsage.costLimit) * 100
                    : 0
                }
                stale={isStale}
              />
            )}

            {/* Status and Last Updated */}
            <div className="flex items-center justify-between pt-4 border-t border-border/40">
              <div className="flex items-center gap-2">
                {isStale ? (
                  <div className="flex items-center gap-2 text-orange-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Data may be stale</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Up to date</span>
                  </div>
                )}
              </div>
              <a
                href="https://status.claude.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Claude Status <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
