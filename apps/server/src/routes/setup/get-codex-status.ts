/**
 * Business logic for getting Codex CLI status
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { getApiKey } from './common.js';

const execAsync = promisify(exec);

export async function getCodexStatus() {
  let installed = false;
  let version = '';
  let cliPath = '';
  let method = 'none';

  const isWindows = process.platform === 'win32';

  // Try to find Codex CLI using platform-specific command
  try {
    // Use 'where' on Windows, 'which' on Unix-like systems
    const findCommand = isWindows ? 'where codex' : 'which codex';
    const { stdout } = await execAsync(findCommand);
    // 'where' on Windows can return multiple paths - take the first one
    cliPath = stdout.trim().split(/\r?\n/)[0];
    installed = true;
    method = 'path';

    // Get version
    try {
      const { stdout: versionOut } = await execAsync('codex --version');
      version = versionOut.trim();
    } catch {
      // Version command might not be available
    }
  } catch {
    // Not in PATH, try common locations based on platform
    const commonPaths = isWindows
      ? (() => {
          const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
          return [
            // Windows-specific paths
            path.join(os.homedir(), '.local', 'bin', 'codex.exe'),
            path.join(appData, 'npm', 'codex.cmd'),
            path.join(appData, 'npm', 'codex'),
            path.join(appData, '.npm-global', 'bin', 'codex.cmd'),
            path.join(appData, '.npm-global', 'bin', 'codex'),
          ];
        })()
      : [
          // Unix (Linux/macOS) paths
          path.join(os.homedir(), '.local', 'bin', 'codex'),
          path.join(os.homedir(), '.codex', 'local', 'codex'),
          '/usr/local/bin/codex',
          '/opt/homebrew/bin/codex',
          path.join(os.homedir(), '.npm-global', 'bin', 'codex'),
        ];

    for (const p of commonPaths) {
      try {
        await fs.access(p);
        cliPath = p;
        installed = true;
        method = 'local';

        // Get version from this path
        try {
          const { stdout: versionOut } = await execAsync(`"${p}" --version`);
          version = versionOut.trim();
        } catch {
          // Version command might not be available
        }
        break;
      } catch {
        // Not found at this path
      }
    }
  }

  // Check authentication - detect all possible auth methods
  let auth = {
    authenticated: false,
    method: 'none' as string,
    hasCredentialsFile: false,
    hasToken: false,
    hasStoredApiKey: !!getApiKey('openai'),
    hasEnvApiKey: !!process.env.OPENAI_API_KEY,
    // Additional fields for detailed status
    apiKeyValid: false,
    hasCliAuth: false,
    hasRecentActivity: false,
  };

  const codexDir = path.join(os.homedir(), '.codex');

  // Check for Codex auth.json file
  const authJsonPath = path.join(codexDir, 'auth.json');
  try {
    const authContent = await fs.readFile(authJsonPath, 'utf-8');
    const authData = JSON.parse(authContent);
    auth.hasCredentialsFile = true;

    // Check if there's a valid token (can be at top level or nested under 'tokens')
    const tokens = authData.tokens || authData;
    if (
      tokens.access_token ||
      tokens.api_key ||
      tokens.token ||
      authData.OPENAI_API_KEY ||
      authData.access_token
    ) {
      auth.hasToken = true;
      auth.authenticated = true;
      auth.hasCliAuth = true;
      auth.method = 'cli_authenticated';
    }
  } catch {
    // No auth.json file or invalid format
  }

  // Check for config file with API key
  const configPath = path.join(codexDir, 'config.json');
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const configData = JSON.parse(configContent);

    if (configData.apiKey || configData.api_key) {
      auth.hasCredentialsFile = true;
      auth.apiKeyValid = true;
      auth.authenticated = true;
      auth.method = 'api_key';
    }
  } catch {
    // No config file or invalid format
  }

  // Environment variable takes priority
  if (auth.hasEnvApiKey) {
    auth.authenticated = true;
    auth.apiKeyValid = true;
    auth.method = 'api_key_env';
  }

  // In-memory stored API key (from settings UI)
  if (!auth.authenticated && getApiKey('openai')) {
    auth.authenticated = true;
    auth.apiKeyValid = true;
    auth.method = 'api_key';
  }

  return {
    status: installed ? 'installed' : 'not_installed',
    installed,
    method,
    version,
    path: cliPath,
    auth,
    recommendation: !installed
      ? 'Install Codex CLI using: npm install -g @openai/codex'
      : undefined,
    installCommands: !installed
      ? {
          npm: 'npm install -g @openai/codex',
        }
      : undefined,
  };
}
