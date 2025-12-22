import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { useSetupStore } from '@/store/setup-store';
import { toast } from 'sonner';
import type { CliStatus } from '../shared/types';

interface CliStatusProps {
  status: CliStatus | null;
  isChecking: boolean;
  onRefresh: () => void;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'error';

export function CodexCliStatus({ status, isChecking, onRefresh }: CliStatusProps) {
  const { codexAuthStatus, setCodexAuthStatus } = useSetupStore();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    codexAuthStatus?.authenticated ? 'verified' : 'idle'
  );
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const verifyCodexAuth = useCallback(async () => {
    setVerificationStatus('verifying');
    setVerificationError(null);

    try {
      const api = getElectronAPI();
      if (!api.setup?.verifyCodexAuth) {
        setVerificationStatus('error');
        setVerificationError('Verification API not available');
        return;
      }

      const result = await api.setup.verifyCodexAuth();

      if (result.authenticated) {
        setVerificationStatus('verified');
        setCodexAuthStatus({
          authenticated: true,
          method: 'cli_authenticated',
          hasCredentialsFile: codexAuthStatus?.hasCredentialsFile || false,
        });
        toast.success('Codex CLI authentication verified!');
      } else {
        setVerificationStatus('error');
        setVerificationError(result.error || 'Authentication failed');
        setCodexAuthStatus({
          authenticated: false,
          method: 'none',
          hasCredentialsFile: codexAuthStatus?.hasCredentialsFile || false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setVerificationStatus('error');
      setVerificationError(errorMessage);
    }
  }, [codexAuthStatus, setCodexAuthStatus]);

  if (!status) return null;

  const isInstalled = status.success && status.status === 'installed';
  const isAuthenticated = verificationStatus === 'verified' || codexAuthStatus?.authenticated;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center border border-green-500/20">
              <Cpu className="w-5 h-5 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              OpenAI Codex CLI
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isChecking}
            data-testid="refresh-codex-cli"
            title="Refresh Codex CLI detection"
            className={cn(
              'h-9 w-9 rounded-lg',
              'hover:bg-accent/50 hover:scale-105',
              'transition-all duration-200'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isChecking && 'animate-spin')} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">
          Codex CLI provides better performance for long-running tasks with OpenAI models.
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {isInstalled ? (
          <div className="space-y-4">
            {/* Installation Status */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-400">Codex CLI Installed</p>
                <div className="text-xs text-emerald-400/70 mt-1.5 space-y-0.5">
                  {status.method && (
                    <p>
                      Method: <span className="font-mono">{status.method}</span>
                    </p>
                  )}
                  {status.version && (
                    <p>
                      Version: <span className="font-mono">{status.version}</span>
                    </p>
                  )}
                  {status.path && (
                    <p className="truncate" title={status.path}>
                      Path: <span className="font-mono text-[10px]">{status.path}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Authentication Status */}
            {verificationStatus === 'verified' || isAuthenticated ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-400">Authentication Verified</p>
                  <p className="text-xs text-emerald-400/70 mt-1">
                    {codexAuthStatus?.method === 'cli_authenticated'
                      ? 'Authenticated via codex login'
                      : codexAuthStatus?.method === 'api_key_env'
                        ? 'Using OPENAI_API_KEY environment variable'
                        : codexAuthStatus?.method === 'api_key'
                          ? 'Using stored API key'
                          : 'Ready to use OpenAI models'}
                  </p>
                </div>
              </div>
            ) : verificationStatus === 'verifying' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <div>
                  <p className="font-medium text-foreground">Verifying authentication...</p>
                  <p className="text-sm text-muted-foreground">Running a test query</p>
                </div>
              </div>
            ) : verificationStatus === 'error' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Verification failed</p>
                    <p className="text-sm text-red-400 mt-1">{verificationError}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-accent/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">
                    Run this command to authenticate:
                  </p>
                  <code className="text-xs text-foreground/80 font-mono">codex login</code>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-400">Authentication Not Verified</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Click "Verify Authentication" to test your Codex CLI setup.
                  </p>
                </div>
              </div>
            )}

            {/* Verify Button */}
            {verificationStatus !== 'verified' && !isAuthenticated && (
              <Button
                onClick={verifyCodexAuth}
                disabled={verificationStatus === 'verifying'}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                data-testid="verify-codex-auth"
              >
                {verificationStatus === 'verifying' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : verificationStatus === 'error' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Verification
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify Authentication
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Not Installed Status */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/20 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-400">Codex CLI Not Detected</p>
                <p className="text-xs text-amber-400/70 mt-1">
                  {status.recommendation ||
                    'Install Codex CLI to use GPT-4.1, o3, and o4-mini models.'}
                </p>
              </div>
            </div>

            {/* Installation Instructions */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-foreground/80">Installation Options:</p>

              {/* npm */}
              <div className="p-3 rounded-xl bg-accent/30 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                  npm (Recommended)
                </p>
                <code className="text-xs text-foreground/80 font-mono break-all">
                  npm install -g @openai/codex
                </code>
              </div>

              {/* Homebrew */}
              <div className="p-3 rounded-xl bg-accent/30 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                  macOS (Homebrew)
                </p>
                <code className="text-xs text-foreground/80 font-mono break-all">
                  brew install openai/codex/codex
                </code>
              </div>

              {/* Documentation Link */}
              <a
                href="https://github.com/openai/codex"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-brand-500 hover:underline"
              >
                View documentation
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
