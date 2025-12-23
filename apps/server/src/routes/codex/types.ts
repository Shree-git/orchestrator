/**
 * Codex Usage types for OpenAI/Codex CLI-based usage tracking
 */

export type CodexUsage = {
  // Daily usage tracking (OpenAI typically uses daily limits)
  dailyTokensUsed: number;
  dailyLimit: number;
  dailyPercentage: number;
  dailyResetTime: string; // ISO date string
  dailyResetText: string; // Raw text like "Resets daily at midnight UTC"

  // Monthly usage tracking (OpenAI billing cycle)
  monthlyTokensUsed: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  monthlyResetTime: string; // ISO date string
  monthlyResetText: string; // Raw text like "Resets monthly on billing date"

  // Cost information
  costUsed: number | null;
  costLimit: number | null;
  costCurrency: string | null;

  // Request rate limits (OpenAI RPM limits)
  requestsUsed: number;
  requestsLimit: number;
  requestsPercentage: number;
  requestsResetTime: string; // ISO date string
  requestsResetText: string; // Raw text like "Resets every minute"

  lastUpdated: string; // ISO date string
  userTimezone: string;
  authenticationRequired: boolean;
};

export type CodexStatus = {
  indicator: {
    color: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  };
  description: string;
};

/**
 * API Response types for Codex usage endpoints
 */
export type CodexUsageResponse = {
  success: boolean;
  data?: CodexUsage;
  error?: string;
  message?: string;
};

export type CodexStatusResponse = {
  success: boolean;
  data?: CodexStatus;
  error?: string;
  message?: string;
};

/**
 * Request types for Codex usage operations
 */
export type CodexUsageRefreshRequest = {
  forceRefresh?: boolean;
};

/**
 * Extended usage information for detailed analytics
 */
export type CodexUsageDetails = CodexUsage & {
  // Model-specific usage (if available)
  modelUsage?: {
    [modelName: string]: {
      tokensUsed: number;
      requestsUsed: number;
      costUsed: number | null;
    };
  };

  // Rate limit details
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };

  // Organization/project info (if available)
  organizationId?: string;
  projectId?: string;
  organizationName?: string;
  projectName?: string;
};

/**
 * Codex authentication status for usage tracking
 */
export type CodexAuthStatus = {
  authenticated: boolean;
  method: 'none' | 'api_key' | 'api_key_env' | 'cli_authenticated';
  hasCredentialsFile: boolean;
  organizationId?: string;
  projectId?: string;
};

/**
 * Usage tracking configuration
 */
export type CodexUsageConfig = {
  enableTracking: boolean;
  refreshIntervalMs: number;
  cacheExpiryMs: number;
  trackModelUsage: boolean;
  trackCosts: boolean;
};

/**
 * Error types specific to Codex usage operations
 */
export type CodexUsageError = {
  code: 'AUTH_REQUIRED' | 'CLI_NOT_AVAILABLE' | 'API_ERROR' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  details?: string;
  timestamp: string;
};

/**
 * Usage alert configuration
 */
export type CodexUsageAlert = {
  type: 'daily' | 'monthly' | 'requests' | 'cost';
  threshold: number; // percentage (0-100)
  enabled: boolean;
  notificationMethods: ('popup' | 'toast' | 'email')[];
};

/**
 * Historical usage data point
 */
export type CodexUsageDataPoint = {
  timestamp: string;
  tokensUsed: number;
  requestsUsed: number;
  costUsed: number | null;
  model?: string;
};

/**
 * Usage analytics summary
 */
export type CodexUsageAnalytics = {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalTokensUsed: number;
  totalRequestsUsed: number;
  totalCostUsed: number | null;
  averageDailyTokens: number;
  averageDailyRequests: number;
  averageDailyCost: number | null;
  topModels: {
    modelName: string;
    tokensUsed: number;
    percentage: number;
  }[];
  dataPoints: CodexUsageDataPoint[];
};
