import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useSetupStore } from '@/store/setup-store';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import {
  CheckCircle2,
  Loader2,
  Terminal,
  Key,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Copy,
  RefreshCw,
  Download,
  Info,
  ShieldCheck,
  XCircle,
  Trash2,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge, TerminalOutput } from '../components';
import { useCliStatus, useCliInstallation, useTokenSave } from '../hooks';

interface ClaudeSetupStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'error';

// Claude Setup Step
// Users can either:
// 1. Have Claude CLI installed and authenticated (verified by running a test query)
// 2. Provide an Anthropic API key manually
export function ClaudeSetupStep({ onNext, onBack, onSkip }: ClaudeSetupStepProps) {
  const {
    claudeCliStatus,
    claudeAuthStatus,
    setClaudeCliStatus,
    setClaudeAuthStatus,
    setClaudeInstallProgress,
    codexCliStatus,
    codexAuthStatus,
    setCodexCliStatus,
    setCodexAuthStatus,
    setCodexInstallProgress,
  } = useSetupStore();
  const { setApiKeys, apiKeys } = useAppStore();

  const [apiKey, setApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  // CLI Verification state
  const [cliVerificationStatus, setCliVerificationStatus] = useState<VerificationStatus>('idle');
  const [cliVerificationError, setCliVerificationError] = useState<string | null>(null);

  // API Key Verification state
  const [apiKeyVerificationStatus, setApiKeyVerificationStatus] =
    useState<VerificationStatus>('idle');
  const [apiKeyVerificationError, setApiKeyVerificationError] = useState<string | null>(null);

  // Delete API Key state
  const [isDeletingApiKey, setIsDeletingApiKey] = useState(false);

  // Codex CLI Verification state
  const [codexCliVerificationStatus, setCodexCliVerificationStatus] =
    useState<VerificationStatus>('idle');
  const [codexCliVerificationError, setCodexCliVerificationError] = useState<string | null>(null);
  const [isCheckingCodex, setIsCheckingCodex] = useState(false);
  const [isSavingOpenaiKey, setIsSavingOpenaiKey] = useState(false);

  // Memoize API functions to prevent infinite loops
  const statusApi = useCallback(
    () => getElectronAPI().setup?.getClaudeStatus() || Promise.reject(),
    []
  );

  const installApi = useCallback(
    () => getElectronAPI().setup?.installClaude() || Promise.reject(),
    []
  );

  const getStoreState = useCallback(() => useSetupStore.getState().claudeCliStatus, []);

  // Use custom hooks
  const { isChecking, checkStatus } = useCliStatus({
    cliType: 'claude',
    statusApi,
    setCliStatus: setClaudeCliStatus,
    setAuthStatus: setClaudeAuthStatus,
  });

  const onInstallSuccess = useCallback(() => {
    checkStatus();
  }, [checkStatus]);

  const { isInstalling, installProgress, install } = useCliInstallation({
    cliType: 'claude',
    installApi,
    onProgressEvent: getElectronAPI().setup?.onInstallProgress,
    onSuccess: onInstallSuccess,
    getStoreState,
  });

  const { isSaving: isSavingApiKey, saveToken: saveApiKeyToken } = useTokenSave({
    provider: 'anthropic',
    onSuccess: () => {
      setClaudeAuthStatus({
        authenticated: true,
        method: 'api_key',
        hasCredentialsFile: false,
        apiKeyValid: true,
      });
      setApiKeys({ ...apiKeys, anthropic: apiKey });
      toast.success('API key saved successfully!');
    },
  });

  // Verify CLI authentication by running a test query (uses CLI credentials only, not API key)
  const verifyCliAuth = useCallback(async () => {
    setCliVerificationStatus('verifying');
    setCliVerificationError(null);

    try {
      const api = getElectronAPI();
      if (!api.setup?.verifyClaudeAuth) {
        setCliVerificationStatus('error');
        setCliVerificationError('Verification API not available');
        return;
      }

      // Pass "cli" to verify CLI authentication only (ignores any API key)
      const result = await api.setup.verifyClaudeAuth('cli');

      // Check for "Limit reached" error - treat as unverified
      const hasLimitReachedError =
        result.error?.toLowerCase().includes('limit reached') ||
        result.error?.toLowerCase().includes('rate limit');

      if (result.authenticated && !hasLimitReachedError) {
        setCliVerificationStatus('verified');
        setClaudeAuthStatus({
          authenticated: true,
          method: 'cli_authenticated',
          hasCredentialsFile: claudeAuthStatus?.hasCredentialsFile || false,
        });
        toast.success('Claude CLI authentication verified!');
      } else {
        setCliVerificationStatus('error');
        setCliVerificationError(
          hasLimitReachedError
            ? 'Rate limit reached. Please try again later.'
            : result.error || 'Authentication failed'
        );
        setClaudeAuthStatus({
          authenticated: false,
          method: 'none',
          hasCredentialsFile: claudeAuthStatus?.hasCredentialsFile || false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      // Also check for limit reached in caught errors
      const isLimitError =
        errorMessage.toLowerCase().includes('limit reached') ||
        errorMessage.toLowerCase().includes('rate limit');
      setCliVerificationStatus('error');
      setCliVerificationError(
        isLimitError ? 'Rate limit reached. Please try again later.' : errorMessage
      );
    }
  }, [claudeAuthStatus, setClaudeAuthStatus]);

  // Verify API Key authentication (uses API key only)
  const verifyApiKeyAuth = useCallback(async () => {
    setApiKeyVerificationStatus('verifying');
    setApiKeyVerificationError(null);

    try {
      const api = getElectronAPI();
      if (!api.setup?.verifyClaudeAuth) {
        setApiKeyVerificationStatus('error');
        setApiKeyVerificationError('Verification API not available');
        return;
      }

      // Pass "api_key" to verify API key authentication only
      const result = await api.setup.verifyClaudeAuth('api_key');

      if (result.authenticated) {
        setApiKeyVerificationStatus('verified');
        setClaudeAuthStatus({
          authenticated: true,
          method: 'api_key',
          hasCredentialsFile: false,
          apiKeyValid: true,
        });
        toast.success('API key authentication verified!');
      } else {
        setApiKeyVerificationStatus('error');
        setApiKeyVerificationError(result.error || 'Authentication failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setApiKeyVerificationStatus('error');
      setApiKeyVerificationError(errorMessage);
    }
  }, [setClaudeAuthStatus]);

  // Delete API Key
  const deleteApiKey = useCallback(async () => {
    setIsDeletingApiKey(true);
    try {
      const api = getElectronAPI();
      if (!api.setup?.deleteApiKey) {
        toast.error('Delete API not available');
        return;
      }

      const result = await api.setup.deleteApiKey('anthropic');
      if (result.success) {
        // Clear local state
        setApiKey('');
        setApiKeys({ ...apiKeys, anthropic: '' });
        setApiKeyVerificationStatus('idle');
        setApiKeyVerificationError(null);
        setClaudeAuthStatus({
          authenticated: false,
          method: 'none',
          hasCredentialsFile: claudeAuthStatus?.hasCredentialsFile || false,
        });
        toast.success('API key deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete API key');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete API key';
      toast.error(errorMessage);
    } finally {
      setIsDeletingApiKey(false);
    }
  }, [apiKeys, setApiKeys, claudeAuthStatus, setClaudeAuthStatus]);

  // Check Codex CLI status
  const checkCodexStatus = useCallback(async () => {
    setIsCheckingCodex(true);
    try {
      const api = getElectronAPI();
      if (!api.setup?.getCodexStatus) {
        console.error('Codex status API not available');
        return;
      }

      const result = await api.setup.getCodexStatus();
      if (result.success) {
        setCodexCliStatus({
          installed: result.status === 'installed',
          path: result.path || null,
          version: result.version || null,
          method: result.method || 'none',
        });

        if (result.auth) {
          setCodexAuthStatus({
            authenticated: result.auth.authenticated,
            method: result.auth.method as any,
            hasCredentialsFile: result.auth.hasCredentialsFile || false,
            apiKeyValid: result.auth.apiKeyValid,
            hasEnvApiKey: result.auth.hasEnvApiKey,
          });

          // Auto-verify if already authenticated
          if (result.auth.authenticated) {
            setCodexCliVerificationStatus('verified');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Codex status:', error);
    } finally {
      setIsCheckingCodex(false);
    }
  }, [setCodexCliStatus, setCodexAuthStatus]);

  // Save OpenAI API Key
  const saveOpenaiApiKey = useCallback(async () => {
    if (!openaiApiKey.trim()) return;

    setIsSavingOpenaiKey(true);
    try {
      const api = getElectronAPI();
      if (!api.setup?.storeApiKey) {
        toast.error('Store API key not available');
        return;
      }

      const result = await api.setup.storeApiKey('openai', openaiApiKey);
      if (result.success) {
        setCodexAuthStatus({
          authenticated: true,
          method: 'api_key',
          hasCredentialsFile: false,
          apiKeyValid: true,
        });
        toast.success('OpenAI API key saved! Click "Verify" to test it.');
      } else {
        toast.error(result.error || 'Failed to save API key');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save API key';
      toast.error(errorMessage);
    } finally {
      setIsSavingOpenaiKey(false);
    }
  }, [openaiApiKey, setCodexAuthStatus]);

  // Verify Codex CLI authentication by running a test query
  const verifyCodexAuth = useCallback(async () => {
    setCodexCliVerificationStatus('verifying');
    setCodexCliVerificationError(null);

    try {
      const api = getElectronAPI();
      if (!api.setup?.verifyCodexAuth) {
        setCodexCliVerificationStatus('error');
        setCodexCliVerificationError('Verification API not available');
        return;
      }

      const result = await api.setup.verifyCodexAuth();

      if (result.authenticated) {
        setCodexCliVerificationStatus('verified');
        setCodexAuthStatus({
          authenticated: true,
          method: 'cli_authenticated',
          hasCredentialsFile: codexAuthStatus?.hasCredentialsFile || false,
        });
        toast.success('Codex CLI authentication verified!');
      } else {
        setCodexCliVerificationStatus('error');
        setCodexCliVerificationError(result.error || 'Authentication failed');
        setCodexAuthStatus({
          authenticated: false,
          method: 'none',
          hasCredentialsFile: codexAuthStatus?.hasCredentialsFile || false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setCodexCliVerificationStatus('error');
      setCodexCliVerificationError(errorMessage);
    }
  }, [codexAuthStatus, setCodexAuthStatus]);

  // Sync install progress to store
  useEffect(() => {
    setClaudeInstallProgress({
      isInstalling,
      output: installProgress.output,
    });
  }, [isInstalling, installProgress, setClaudeInstallProgress]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
    checkCodexStatus();
  }, [checkStatus, checkCodexStatus]);

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard');
  };

  // User is ready if either method is verified
  const hasApiKey =
    !!apiKeys.anthropic ||
    claudeAuthStatus?.method === 'api_key' ||
    claudeAuthStatus?.method === 'api_key_env';
  const isCliVerified = cliVerificationStatus === 'verified';
  const isApiKeyVerified = apiKeyVerificationStatus === 'verified';
  const isCodexVerified = codexCliVerificationStatus === 'verified';
  const isReady = isCliVerified || isApiKeyVerified || isCodexVerified;

  const getAuthMethodLabel = () => {
    if (isApiKeyVerified) return 'API Key';
    if (isCliVerified) return 'Claude CLI';
    if (isCodexVerified) return 'Codex CLI';
    return null;
  };

  // Helper to get status badge for CLI
  const getCliStatusBadge = () => {
    if (cliVerificationStatus === 'verified') {
      return <StatusBadge status="authenticated" label="Verified" />;
    }
    if (cliVerificationStatus === 'error') {
      return <StatusBadge status="error" label="Error" />;
    }
    if (isChecking) {
      return <StatusBadge status="checking" label="Checking..." />;
    }
    if (claudeCliStatus?.installed) {
      // Installed but not yet verified - show yellow unverified badge
      return <StatusBadge status="unverified" label="Unverified" />;
    }
    return <StatusBadge status="not_installed" label="Not Installed" />;
  };

  // Helper to get status badge for API Key
  const getApiKeyStatusBadge = () => {
    if (apiKeyVerificationStatus === 'verified') {
      return <StatusBadge status="authenticated" label="Verified" />;
    }
    if (apiKeyVerificationStatus === 'error') {
      return <StatusBadge status="error" label="Error" />;
    }
    if (hasApiKey) {
      // API key configured but not yet verified - show yellow unverified badge
      return <StatusBadge status="unverified" label="Unverified" />;
    }
    return <StatusBadge status="not_authenticated" label="Not Set" />;
  };

  // Helper to get status badge for Codex CLI
  const getCodexStatusBadge = () => {
    if (codexCliVerificationStatus === 'verified') {
      return <StatusBadge status="authenticated" label="Verified" />;
    }
    if (codexCliVerificationStatus === 'error') {
      return <StatusBadge status="error" label="Error" />;
    }
    if (isCheckingCodex) {
      return <StatusBadge status="checking" label="Checking..." />;
    }
    if (codexCliStatus?.installed || codexAuthStatus?.authenticated) {
      // Installed but not yet verified - show yellow unverified badge
      return <StatusBadge status="unverified" label="Unverified" />;
    }
    return <StatusBadge status="not_installed" label="Not Installed" />;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <Terminal className="w-8 h-8 text-brand-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">API Key Setup</h2>
        <p className="text-muted-foreground">Configure for code generation</p>
      </div>

      {/* Requirements Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5" />
              Authentication Methods
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={checkStatus} disabled={isChecking}>
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            Choose one of the following methods to authenticate with Claude:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Option 1: Claude CLI */}
            <AccordionItem value="cli" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <Terminal
                      className={`w-5 h-5 ${
                        cliVerificationStatus === 'verified'
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-left">
                      <p className="font-medium text-foreground">Claude CLI</p>
                      <p className="text-sm text-muted-foreground">Use Claude Code subscription</p>
                    </div>
                  </div>
                  {getCliStatusBadge()}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {/* CLI Install Section */}
                {!claudeCliStatus?.installed && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">Install Claude CLI</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">macOS / Linux</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-foreground">
                          curl -fsSL https://claude.ai/install.sh | bash
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            copyCommand('curl -fsSL https://claude.ai/install.sh | bash')
                          }
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Windows</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-foreground">
                          irm https://claude.ai/install.ps1 | iex
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCommand('irm https://claude.ai/install.ps1 | iex')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {isInstalling && <TerminalOutput lines={installProgress.output} />}

                    <Button
                      onClick={install}
                      disabled={isInstalling}
                      className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                      data-testid="install-claude-button"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Auto Install
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* CLI Version Info */}
                {claudeCliStatus?.installed && claudeCliStatus?.version && (
                  <p className="text-sm text-muted-foreground">
                    Version: {claudeCliStatus.version}
                  </p>
                )}

                {/* CLI Verification Status */}
                {cliVerificationStatus === 'verifying' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <div>
                      <p className="font-medium text-foreground">Verifying CLI authentication...</p>
                      <p className="text-sm text-muted-foreground">Running a test query</p>
                    </div>
                  </div>
                )}

                {cliVerificationStatus === 'verified' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-foreground">CLI Authentication verified!</p>
                      <p className="text-sm text-muted-foreground">
                        Your Claude CLI is working correctly.
                      </p>
                    </div>
                  </div>
                )}

                {cliVerificationStatus === 'error' && cliVerificationError && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Verification failed</p>
                      <p className="text-sm text-red-400 mt-1">{cliVerificationError}</p>
                      {cliVerificationError.includes('login') && (
                        <div className="mt-3 p-3 rounded bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-2">
                            Run this command in your terminal:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-foreground">
                              claude login
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyCommand('claude login')}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CLI Verify Button - Hide if CLI is verified */}
                {cliVerificationStatus !== 'verified' && (
                  <Button
                    onClick={verifyCliAuth}
                    disabled={cliVerificationStatus === 'verifying' || !claudeCliStatus?.installed}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                    data-testid="verify-cli-button"
                  >
                    {cliVerificationStatus === 'verifying' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : cliVerificationStatus === 'error' ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Verification
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Verify CLI Authentication
                      </>
                    )}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Option 2: API Key */}
            <AccordionItem value="api-key" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <Key
                      className={`w-5 h-5 ${
                        apiKeyVerificationStatus === 'verified'
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-left">
                      <p className="font-medium text-foreground">Anthropic API Key</p>
                      <p className="text-sm text-muted-foreground">
                        Pay-per-use with your own API key
                      </p>
                    </div>
                  </div>
                  {getApiKeyStatusBadge()}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {/* API Key Input */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="space-y-2">
                    <Label htmlFor="anthropic-key" className="text-foreground">
                      Anthropic API Key
                    </Label>
                    <Input
                      id="anthropic-key"
                      type="password"
                      placeholder="sk-ant-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-input border-border text-foreground"
                      data-testid="anthropic-api-key-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have an API key?{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        Get one from Anthropic Console
                        <ExternalLink className="w-3 h-3 inline ml-1" />
                      </a>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveApiKeyToken(apiKey)}
                      disabled={isSavingApiKey || !apiKey.trim()}
                      className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
                      data-testid="save-anthropic-key-button"
                    >
                      {isSavingApiKey ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save API Key'
                      )}
                    </Button>
                    {hasApiKey && (
                      <Button
                        onClick={deleteApiKey}
                        disabled={isDeletingApiKey}
                        variant="outline"
                        className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        data-testid="delete-anthropic-key-button"
                      >
                        {isDeletingApiKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* API Key Verification Status */}
                {apiKeyVerificationStatus === 'verifying' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <div>
                      <p className="font-medium text-foreground">Verifying API key...</p>
                      <p className="text-sm text-muted-foreground">Running a test query</p>
                    </div>
                  </div>
                )}

                {apiKeyVerificationStatus === 'verified' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-foreground">API Key verified!</p>
                      <p className="text-sm text-muted-foreground">
                        Your API key is working correctly.
                      </p>
                    </div>
                  </div>
                )}

                {apiKeyVerificationStatus === 'error' && apiKeyVerificationError && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Verification failed</p>
                      <p className="text-sm text-red-400 mt-1">{apiKeyVerificationError}</p>
                    </div>
                  </div>
                )}

                {/* API Key Verify Button - Hide if API key is verified */}
                {apiKeyVerificationStatus !== 'verified' && (
                  <Button
                    onClick={verifyApiKeyAuth}
                    disabled={apiKeyVerificationStatus === 'verifying' || !hasApiKey}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                    data-testid="verify-api-key-button"
                  >
                    {apiKeyVerificationStatus === 'verifying' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : apiKeyVerificationStatus === 'error' ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Verification
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Verify API Key
                      </>
                    )}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Option 3: OpenAI Codex CLI */}
            <AccordionItem value="codex-cli" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <Cpu
                      className={`w-5 h-5 ${
                        codexCliVerificationStatus === 'verified'
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-left">
                      <p className="font-medium text-foreground">OpenAI Codex CLI</p>
                      <p className="text-sm text-muted-foreground">
                        Use ChatGPT/OpenAI models via Codex CLI
                      </p>
                    </div>
                  </div>
                  {getCodexStatusBadge()}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {/* Codex CLI Install Section */}
                {!codexCliStatus?.installed && !codexAuthStatus?.authenticated && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">Install Codex CLI</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">npm (Recommended)</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-foreground">
                          npm install -g @openai/codex
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCommand('npm install -g @openai/codex')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">macOS (Homebrew)</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono text-foreground">
                          brew install openai/codex/codex
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCommand('brew install openai/codex/codex')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      After installing, run{' '}
                      <code className="bg-muted px-1 py-0.5 rounded">codex login</code> to
                      authenticate.
                    </p>
                  </div>
                )}

                {/* OpenAI API Key Input */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">OpenAI API Key (Alternative)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai-key" className="text-foreground">
                      API Key
                    </Label>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      className="bg-input border-border text-foreground"
                      data-testid="openai-api-key-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have an API key?{' '}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        Get one from OpenAI Platform
                        <ExternalLink className="w-3 h-3 inline ml-1" />
                      </a>
                    </p>
                  </div>

                  <Button
                    onClick={saveOpenaiApiKey}
                    disabled={isSavingOpenaiKey || !openaiApiKey.trim()}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                    data-testid="save-openai-key-button"
                  >
                    {isSavingOpenaiKey ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save OpenAI API Key'
                    )}
                  </Button>
                </div>

                {/* Codex CLI Version Info */}
                {codexCliStatus?.installed && codexCliStatus?.version && (
                  <p className="text-sm text-muted-foreground">Version: {codexCliStatus.version}</p>
                )}

                {/* Codex CLI Verification Status */}
                {codexCliVerificationStatus === 'verifying' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <div>
                      <p className="font-medium text-foreground">
                        Verifying Codex authentication...
                      </p>
                      <p className="text-sm text-muted-foreground">Running a test query</p>
                    </div>
                  </div>
                )}

                {codexCliVerificationStatus === 'verified' && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-foreground">Codex CLI ready!</p>
                      <p className="text-sm text-muted-foreground">
                        You can now use OpenAI models.
                      </p>
                    </div>
                  </div>
                )}

                {codexCliVerificationStatus === 'error' && codexCliVerificationError && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Verification failed</p>
                      <p className="text-sm text-red-400 mt-1">{codexCliVerificationError}</p>
                    </div>
                  </div>
                )}

                {/* Codex Verify Button */}
                {codexCliVerificationStatus !== 'verified' && (
                  <Button
                    onClick={verifyCodexAuth}
                    disabled={codexCliVerificationStatus === 'verifying'}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                    data-testid="verify-codex-button"
                  >
                    {codexCliVerificationStatus === 'verifying' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : codexCliVerificationStatus === 'error' ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Verification
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Verify Codex Authentication
                      </>
                    )}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            Skip for now
          </Button>
          <Button
            onClick={onNext}
            disabled={!isReady}
            className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="claude-next-button"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
