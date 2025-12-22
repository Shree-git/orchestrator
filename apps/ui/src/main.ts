/**
 * Electron main process (TypeScript)
 *
 * This version spawns the backend server and uses HTTP API for most operations.
 * Only native features (dialogs, shell) use IPC.
 */

import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import http, { Server } from 'http';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';

// Global error handlers to prevent EPIPE crashes
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors - they happen when writing to closed pipes
  if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
    console.warn('[Electron] EPIPE error ignored (pipe closed)');
    return;
  }
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron] Unhandled rejection at:', promise, 'reason:', reason);
});

// Development environment
const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Load environment variables from .env file (development only)
if (isDev) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch (error) {
    console.warn('[Electron] dotenv not available:', (error as Error).message);
  }
}

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let staticServer: Server | null = null;
const SERVER_PORT = 3008;
const STATIC_PORT = 3007;

/**
 * Get icon path - works in both dev and production, cross-platform
 */
function getIconPath(): string | null {
  let iconFile: string;
  if (process.platform === 'win32') {
    iconFile = 'icon.ico';
  } else if (process.platform === 'darwin') {
    iconFile = 'logo_larger.png';
  } else {
    iconFile = 'logo_larger.png';
  }

  const iconPath = isDev
    ? path.join(__dirname, '../public', iconFile)
    : path.join(__dirname, '../dist/public', iconFile);

  if (!fs.existsSync(iconPath)) {
    console.warn(`[Electron] Icon not found at: ${iconPath}`);
    return null;
  }

  return iconPath;
}

/**
 * Check if a port is in use
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Wait for port to be available
 */
async function waitForPort(port: number, maxWait = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (!(await isPortInUse(port))) {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.warn(`[Electron] Port ${port} still in use after ${maxWait}ms`);
}

/**
 * Start static file server for production builds
 */
async function startStaticServer(): Promise<void> {
  // Wait for port to be available
  await waitForPort(STATIC_PORT);

  const staticPath = path.join(__dirname, '../dist');

  staticServer = http.createServer((request, response) => {
    let filePath = path.join(staticPath, request.url?.split('?')[0] || '/');

    if (filePath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    } else if (!path.extname(filePath)) {
      // For client-side routing, serve index.html for paths without extensions
      const possibleFile = filePath + '.html';
      if (!fs.existsSync(filePath) && !fs.existsSync(possibleFile)) {
        filePath = path.join(staticPath, 'index.html');
      } else if (fs.existsSync(possibleFile)) {
        filePath = possibleFile;
      }
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats?.isFile()) {
        filePath = path.join(staticPath, 'index.html');
      }

      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(500);
          response.end('Server Error');
          return;
        }

        const ext = path.extname(filePath);
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.eot': 'application/vnd.ms-fontobject',
        };

        response.writeHead(200, {
          'Content-Type': contentTypes[ext] || 'application/octet-stream',
        });
        response.end(content);
      });
    });
  });

  return new Promise((resolve, reject) => {
    staticServer!.listen(STATIC_PORT, () => {
      console.log(`[Electron] Static server running at http://localhost:${STATIC_PORT}`);
      resolve();
    });
    staticServer!.on('error', reject);
  });
}

/**
 * Start the backend server
 */
async function startServer(): Promise<void> {
  // Wait for port to be available
  await waitForPort(SERVER_PORT);

  let command: string;
  let args: string[];
  let serverPath: string;

  if (isDev) {
    command = 'node';
    serverPath = path.join(__dirname, '../../server/src/index.ts');

    const serverNodeModules = path.join(__dirname, '../../server/node_modules/tsx');
    const rootNodeModules = path.join(__dirname, '../../../node_modules/tsx');

    let tsxCliPath: string;
    if (fs.existsSync(path.join(serverNodeModules, 'dist/cli.mjs'))) {
      tsxCliPath = path.join(serverNodeModules, 'dist/cli.mjs');
    } else if (fs.existsSync(path.join(rootNodeModules, 'dist/cli.mjs'))) {
      tsxCliPath = path.join(rootNodeModules, 'dist/cli.mjs');
    } else {
      try {
        tsxCliPath = require.resolve('tsx/cli.mjs', {
          paths: [path.join(__dirname, '../../server')],
        });
      } catch {
        throw new Error("Could not find tsx. Please run 'npm install' in the server directory.");
      }
    }

    args = [tsxCliPath, 'watch', serverPath];
  } else {
    command = 'node';
    serverPath = path.join(process.resourcesPath, 'server', 'index.js');
    args = [serverPath];

    if (!fs.existsSync(serverPath)) {
      throw new Error(`Server not found at: ${serverPath}`);
    }
  }

  const serverNodeModules = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'node_modules')
    : path.join(__dirname, '../../server/node_modules');

  const env = {
    ...process.env,
    PORT: SERVER_PORT.toString(),
    DATA_DIR: app.getPath('userData'),
    NODE_PATH: serverNodeModules,
    // Only set ALLOWED_ROOT_DIRECTORY if explicitly provided in environment
    // If not set, server will allow access to all paths
    ...(process.env.ALLOWED_ROOT_DIRECTORY && {
      ALLOWED_ROOT_DIRECTORY: process.env.ALLOWED_ROOT_DIRECTORY,
    }),
  };

  console.log('[Electron] Starting backend server...');
  console.log('[Electron] Server path:', serverPath);
  console.log('[Electron] NODE_PATH:', serverNodeModules);

  serverProcess = spawn(command, args, {
    cwd: path.dirname(serverPath),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Safe logging function that handles EPIPE errors
  const safeLog = (prefix: string, data: Buffer) => {
    try {
      const message = data.toString().trim();
      if (message) {
        console.log(`${prefix} ${message}`);
      }
    } catch {
      // Ignore logging errors
    }
  };

  // Handle stdout with error protection
  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => safeLog('[Server]', data));
    serverProcess.stdout.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
        console.warn('[Electron] Server stdout error:', err.message);
      }
    });
  }

  // Handle stderr with error protection
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (data) => safeLog('[Server Error]', data));
    serverProcess.stderr.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
        console.warn('[Electron] Server stderr error:', err.message);
      }
    });
  }

  serverProcess.on('close', (code) => {
    // Remove stream listeners to prevent EPIPE errors after process closes
    serverProcess?.stdout?.removeAllListeners();
    serverProcess?.stderr?.removeAllListeners();
    console.log(`[Server] Process exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    console.error(`[Server] Failed to start server process:`, err);
    serverProcess?.stdout?.removeAllListeners();
    serverProcess?.stderr?.removeAllListeners();
    serverProcess = null;
  });

  await waitForServer();
}

/**
 * Wait for server to be available
 */
async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log('[Electron] Server is ready');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error('Server failed to start');
}

/**
 * Create the main window
 */
function createWindow(): void {
  const iconPath = getIconPath();
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1600,
    height: 950,
    minWidth: 1280,
    minHeight: 768,
    show: true, // Explicitly show window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
  };

  if (iconPath) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Ensure window shows when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      // On macOS, bring the app to front
      if (process.platform === 'darwin') {
        app.focus({ steal: true });
      }
    }
  });

  // Fallback: also show on did-finish-load
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      // On macOS, bring the app to front
      if (process.platform === 'darwin') {
        app.focus({ steal: true });
      }
    }
  });

  // Load Vite dev server in development or static server in production
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else if (isDev) {
    // Fallback for dev without Vite server URL
    mainWindow.loadURL(`http://localhost:${STATIC_PORT}`);
  } else {
    mainWindow.loadURL(`http://localhost:${STATIC_PORT}`);
  }

  if (isDev && process.env.OPEN_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Ensure userData path is consistent across dev/prod so files land in Automaker dir
  try {
    const desiredUserDataPath = path.join(app.getPath('appData'), 'Automaker');
    if (app.getPath('userData') !== desiredUserDataPath) {
      app.setPath('userData', desiredUserDataPath);
      console.log('[Electron] userData path set to:', desiredUserDataPath);
    }
  } catch (error) {
    console.warn('[Electron] Failed to set userData path:', (error as Error).message);
  }

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = getIconPath();
    if (iconPath) {
      try {
        app.dock.setIcon(iconPath);
      } catch (error) {
        console.warn('[Electron] Failed to set dock icon:', (error as Error).message);
      }
    }
  }

  try {
    // Start static file server in production
    if (app.isPackaged) {
      await startStaticServer();
    }

    // Start backend server
    await startServer();

    // Create window
    createWindow();
  } catch (error) {
    console.error('[Electron] Failed to start:', error);
    app.quit();
  }

  app.on('activate', () => {
    // macOS: Re-create window when dock icon is clicked and no windows exist
    console.log('[Electron] ACTIVATE event - windows:', BrowserWindow.getAllWindows().length);
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Electron] Creating new window from activate');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[Electron] Stopping server...');
    // Remove stream listeners first to prevent EPIPE errors during shutdown
    serverProcess.stdout?.removeAllListeners();
    serverProcess.stderr?.removeAllListeners();
    serverProcess.removeAllListeners();
    // Use SIGKILL to ensure the process actually dies
    serverProcess.kill('SIGKILL');
    serverProcess = null;
  }

  if (staticServer) {
    console.log('[Electron] Stopping static server...');
    staticServer.close();
    staticServer = null;
  }
});

// Also handle quit event to ensure cleanup
app.on('quit', () => {
  // Final cleanup - kill any remaining server process
  if (serverProcess && serverProcess.pid) {
    try {
      process.kill(serverProcess.pid, 'SIGKILL');
    } catch {
      // Process already dead
    }
    serverProcess = null;
  }
});

// ============================================
// IPC Handlers - Only native features
// ============================================

// Native file dialogs
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) {
    return { canceled: true, filePaths: [] };
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result;
});

ipcMain.handle('dialog:openFile', async (_, options = {}) => {
  if (!mainWindow) {
    return { canceled: true, filePaths: [] };
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options,
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async (_, options = {}) => {
  if (!mainWindow) {
    return { canceled: true, filePath: undefined };
  }
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Shell operations
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('shell:openPath', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Open file in editor (VS Code, etc.) with optional line/column
ipcMain.handle(
  'shell:openInEditor',
  async (_, filePath: string, line?: number, column?: number) => {
    try {
      // Build VS Code URL scheme: vscode://file/path:line:column
      // This works on all platforms where VS Code is installed
      // URL encode the path to handle special characters (spaces, brackets, etc.)
      // Handle both Unix (/) and Windows (\) path separators
      const normalizedPath = filePath.replace(/\\/g, '/');
      const encodedPath = normalizedPath.startsWith('/')
        ? '/' + normalizedPath.slice(1).split('/').map(encodeURIComponent).join('/')
        : normalizedPath.split('/').map(encodeURIComponent).join('/');
      let url = `vscode://file${encodedPath}`;
      if (line !== undefined && line > 0) {
        url += `:${line}`;
        if (column !== undefined && column > 0) {
          url += `:${column}`;
        }
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

// App info
ipcMain.handle('app:getPath', async (_, name: Parameters<typeof app.getPath>[0]) => {
  return app.getPath(name);
});

ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
});

ipcMain.handle('app:isPackaged', async () => {
  return app.isPackaged;
});

// Ping - for connection check
ipcMain.handle('ping', async () => {
  return 'pong';
});

// Get server URL for HTTP client
ipcMain.handle('server:getUrl', async () => {
  return `http://localhost:${SERVER_PORT}`;
});
