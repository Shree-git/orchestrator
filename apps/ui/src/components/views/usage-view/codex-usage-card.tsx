import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Code2,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { useAppStore } from '@/store/app-store';
// Create a local type definition for CodexUsage to avoid import issues
type CodexUsage = {
  dailyTokensUsed: number;
  dailyLimit: number;
  dailyPercentage: number;
  dailyResetTime: string;
  dailyResetText: string;
  monthlyTokensUsed: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  monthlyResetTime: string;
  monthlyResetText: string;
  costUsed: number | null;
  costLimit: number | null;
  costCurrency: string | null;
  requestsUsed: number;
  requestsLimit: number;
  requestsPercentage: number;
  requestsResetTime: string;
  requestsResetText: string;
  lastUpdated: string;
  userTimezone: string;
  authenticationRequired: boolean;
};

// Error codes for distinguishing failure modes
const ERROR_CODES = {
  API_BRIDGE_UNAVAILABLE: 'API_BRIDGE_UNAVAILABLE',
  AUTH_ERROR: 'AUTH_ERROR',
  CLI_NOT_AVAILABLE: 'CLI_NOT_AVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const;

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

type UsageError = {
  code: ErrorCode;
  message: string;
};

// Fixed refresh interval (60 seconds for Codex - slightly longer due to API rate limits)
const REFRESH_INTERVAL_SECONDS = 60;

export function CodexUsageCard() {
  const { codexUsage, codexUsageLastUpdated, setCodexUsage } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UsageError | null>(null);

  // Check if data is stale (older than 3 minutes for Codex - longer than Claude due to different refresh patterns)
  const isStale = useMemo(() => {
    return !codexUsageLastUpdated || Date.now() - codexUsageLastUpdated > 3 * 60 * 1000;
  }, [codexUsageLastUpdated]);

  const fetchUsage = useCallback(
    async (isAutoRefresh = false) => {
      if (!isAutoRefresh) setLoading(true);
      setError(null);
      try {
        const api = getElectronAPI();
        if (!api.codex) {
          setError({
            code: ERROR_CODES.API_BRIDGE_UNAVAILABLE,
            message: 'Codex API bridge not available',
          });
          return;
        }
        const data = await api.codex.getUsage();
        if ('error' in data && data.error) {
          setError({
            code: ERROR_CODES.AUTH_ERROR,
            message: data.message || data.error,
          });
          return;
        }
        setCodexUsage(data.data);
      } catch (err) {
        setError({
          code: ERROR_CODES.UNKNOWN,
          message: err instanceof Error ? err.message : 'Failed to fetch Codex usage',
        });
      } finally {
        if (!isAutoRefresh) setLoading(false);
      }
    },
    [setCodexUsage]
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
    if (percentage >= 80) return { color: 'text-red-500', icon: XCircle, bg: 'bg-red-500' };
    if (percentage >= 60)
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
    value,
    limit,
    unit = 'tokens',
  }: {
    title: string;
    subtitle: string;
    percentage: number;
    resetText?: string;
    isPrimary?: boolean;
    stale?: boolean;
    value?: number;
    limit?: number;
    unit?: string;
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
            {value !== undefined && limit !== undefined && limit > 0 && (
              <p className="text-xs text-muted-foreground/80 mt-1">
                {value.toLocaleString()} / {limit.toLocaleString()} {unit}
              </p>
            )}
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
              {(title.includes('Daily') || title.includes('Request')) && (
                <Clock className="w-3 h-3" />
              )}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center border border-green-500/20">
            <Code2 className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Codex Usage</h3>
            <p className="text-sm text-muted-foreground">OpenAI API usage and rate limits</p>
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
                ) : error.code === ERROR_CODES.CLI_NOT_AVAILABLE ? (
                  'Install the Codex CLI or configure your OpenAI API key'
                ) : (
                  <>
                    Make sure Codex CLI is installed or set{' '}
                    <code className="font-mono bg-muted px-1 rounded">OPENAI_API_KEY</code>
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" onClick={() => fetchUsage(false)} className="gap-2 mt-4">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        ) : !codexUsage ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Loading Codex usage data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Daily Usage */}
            <UsageMetric
              title="Daily Usage"
              subtitle="24-hour token limit"
              percentage={codexUsage.dailyPercentage}
              resetText={codexUsage.dailyResetText}
              value={codexUsage.dailyTokensUsed}
              limit={codexUsage.dailyLimit}
              unit="tokens"
              isPrimary={true}
              stale={isStale}
            />

            {/* Secondary Usage Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UsageMetric
                title="Monthly Usage"
                subtitle="Billing cycle limit"
                percentage={codexUsage.monthlyPercentage}
                resetText={codexUsage.monthlyResetText}
                value={codexUsage.monthlyTokensUsed}
                limit={codexUsage.monthlyLimit}
                unit="tokens"
                stale={isStale}
              />
              <UsageMetric
                title="Rate Limits"
                subtitle="Requests per minute"
                percentage={codexUsage.requestsPercentage}
                resetText={codexUsage.requestsResetText}
                value={codexUsage.requestsUsed}
                limit={codexUsage.requestsLimit}
                unit="requests"
                stale={isStale}
              />
            </div>

            {/* Cost Usage */}
            {codexUsage.costLimit && codexUsage.costLimit > 0 && (
              <UsageMetric
                title="Cost Usage"
                subtitle={`${codexUsage.costUsed || 0} / ${codexUsage.costLimit} ${codexUsage.costCurrency || 'USD'}`}
                percentage={
                  codexUsage.costLimit > 0
                    ? ((codexUsage.costUsed || 0) / codexUsage.costLimit) * 100
                    : 0
                }
                stale={isStale}
              />
            )}

            {/* No Data State for Placeholder */}
            {codexUsage.authenticationRequired && (
              <div className="rounded-xl border border-amber-200/40 bg-amber-50/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800">Authentication Required</h4>
                    <p className="text-xs text-amber-700/80 mt-1">
                      Set your OpenAI API key or configure Codex CLI to view usage data.
                    </p>
                  </div>
                </div>
              </div>
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
                href="https://status.openai.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                OpenAI Status <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
