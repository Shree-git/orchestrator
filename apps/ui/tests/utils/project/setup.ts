import { Page } from '@playwright/test';

/**
 * Set up a mock project in localStorage to bypass the welcome screen
 * This simulates having opened a project before
 */
export async function setupMockProject(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  });
}

/**
 * Set up a mock project with custom concurrency value
 */
export async function setupMockProjectWithConcurrency(
  page: Page,
  concurrency: number
): Promise<void> {
  await page.addInitScript((maxConcurrency: number) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: maxConcurrency,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  }, concurrency);
}

/**
 * Set up a mock project with specific running tasks to simulate concurrency limit
 */
export async function setupMockProjectAtConcurrencyLimit(
  page: Page,
  maxConcurrency: number = 1,
  runningTasks: string[] = ['running-task-1']
): Promise<void> {
  await page.addInitScript(
    ({
      maxConcurrency,
      runningTasks,
    }: {
      maxConcurrency: number;
      runningTasks: string[];
    }) => {
      const mockProject = {
        id: 'test-project-1',
        name: 'Test Project',
        path: '/mock/test-project',
        lastOpened: new Date().toISOString(),
      };

      const mockState = {
        state: {
          projects: [mockProject],
          currentProject: mockProject,
          theme: 'dark',
          sidebarOpen: true,
          apiKeys: { anthropic: '', google: '' },
          chatSessions: [],
          chatHistoryOpen: false,
          maxConcurrency: maxConcurrency,
          isAutoModeRunning: false,
          runningAutoTasks: runningTasks,
          autoModeActivityLog: [],
        },
        version: 2, // Must match app-store.ts persist version
      };

      localStorage.setItem('automaker-storage', JSON.stringify(mockState));
    },
    { maxConcurrency, runningTasks }
  );
}

/**
 * Set up a mock project with features in different states
 */
export async function setupMockProjectWithFeatures(
  page: Page,
  options?: {
    maxConcurrency?: number;
    runningTasks?: string[];
    features?: Array<{
      id: string;
      category: string;
      description: string;
      status: 'backlog' | 'in_progress' | 'verified';
      steps?: string[];
    }>;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockFeatures = opts?.features || [];

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: opts?.maxConcurrency ?? 3,
        isAutoModeRunning: false,
        runningAutoTasks: opts?.runningTasks ?? [],
        autoModeActivityLog: [],
        features: mockFeatures,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));

    // Also store features in a global variable that the mock electron API can use
    // This is needed because the board-view loads features from the file system
    (window as any).__mockFeatures = mockFeatures;
  }, options);
}

/**
 * Set up a mock project with a feature context file
 * This simulates an agent having created context for a feature
 */
export async function setupMockProjectWithContextFile(
  page: Page,
  featureId: string,
  contextContent: string = '# Agent Context\n\nPrevious implementation work...'
): Promise<void> {
  await page.addInitScript(
    ({
      featureId,
      contextContent,
    }: {
      featureId: string;
      contextContent: string;
    }) => {
      const mockProject = {
        id: 'test-project-1',
        name: 'Test Project',
        path: '/mock/test-project',
        lastOpened: new Date().toISOString(),
      };

      const mockState = {
        state: {
          projects: [mockProject],
          currentProject: mockProject,
          theme: 'dark',
          sidebarOpen: true,
          apiKeys: { anthropic: '', google: '' },
          chatSessions: [],
          chatHistoryOpen: false,
          maxConcurrency: 3,
        },
        version: 2, // Must match app-store.ts persist version
      };

      localStorage.setItem('automaker-storage', JSON.stringify(mockState));

      // Set up mock file system with a context file for the feature
      // This will be used by the mock electron API
      // Now uses features/{id}/agent-output.md path
      (window as any).__mockContextFile = {
        featureId,
        path: `/mock/test-project/.automaker/features/${featureId}/agent-output.md`,
        content: contextContent,
      };
    },
    { featureId, contextContent }
  );
}

/**
 * Set up a mock project with features that have startedAt timestamps
 */
export async function setupMockProjectWithInProgressFeatures(
  page: Page,
  options?: {
    maxConcurrency?: number;
    runningTasks?: string[];
    features?: Array<{
      id: string;
      category: string;
      description: string;
      status: 'backlog' | 'in_progress' | 'verified';
      steps?: string[];
      startedAt?: string;
    }>;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockFeatures = opts?.features || [];

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: opts?.maxConcurrency ?? 3,
        isAutoModeRunning: false,
        runningAutoTasks: opts?.runningTasks ?? [],
        autoModeActivityLog: [],
        features: mockFeatures,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));

    // Also store features in a global variable that the mock electron API can use
    // This is needed because the board-view loads features from the file system
    (window as any).__mockFeatures = mockFeatures;
  }, options);
}

/**
 * Set up a mock project with a specific current view for route persistence testing
 */
export async function setupMockProjectWithView(
  page: Page,
  view: string
): Promise<void> {
  await page.addInitScript((currentView: string) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        currentView: currentView,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  }, view);
}

/**
 * Set up an empty localStorage (no projects) to show welcome screen
 */
export async function setupEmptyLocalStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockState = {
      state: {
        projects: [],
        currentProject: null,
        currentView: 'welcome',
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
      },
      version: 2, // Must match app-store.ts persist version
    };
    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  });
}

/**
 * Set up mock projects in localStorage but with no current project (for recent projects list)
 */
export async function setupMockProjectsWithoutCurrent(
  page: Page
): Promise<void> {
  await page.addInitScript(() => {
    const mockProjects = [
      {
        id: 'test-project-1',
        name: 'Test Project 1',
        path: '/mock/test-project-1',
        lastOpened: new Date().toISOString(),
      },
      {
        id: 'test-project-2',
        name: 'Test Project 2',
        path: '/mock/test-project-2',
        lastOpened: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    ];

    const mockState = {
      state: {
        projects: mockProjects,
        currentProject: null,
        currentView: 'welcome',
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  });
}

/**
 * Set up a mock project with features that have skipTests enabled
 */
export async function setupMockProjectWithSkipTestsFeatures(
  page: Page,
  options?: {
    maxConcurrency?: number;
    runningTasks?: string[];
    features?: Array<{
      id: string;
      category: string;
      description: string;
      status: 'backlog' | 'in_progress' | 'verified';
      steps?: string[];
      startedAt?: string;
      skipTests?: boolean;
    }>;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockFeatures = opts?.features || [];

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: opts?.maxConcurrency ?? 3,
        isAutoModeRunning: false,
        runningAutoTasks: opts?.runningTasks ?? [],
        autoModeActivityLog: [],
        features: mockFeatures,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  }, options);
}

/**
 * Set up a mock state with multiple projects
 */
export async function setupMockMultipleProjects(
  page: Page,
  projectCount: number = 3
): Promise<void> {
  await page.addInitScript((count: number) => {
    const mockProjects = [];
    for (let i = 0; i < count; i++) {
      mockProjects.push({
        id: `test-project-${i + 1}`,
        name: `Test Project ${i + 1}`,
        path: `/mock/test-project-${i + 1}`,
        lastOpened: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }

    const mockState = {
      state: {
        projects: mockProjects,
        currentProject: mockProjects[0],
        currentView: 'board',
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));
  }, projectCount);
}

/**
 * Set up a mock project with agent output content in the context file
 */
export async function setupMockProjectWithAgentOutput(
  page: Page,
  featureId: string,
  outputContent: string
): Promise<void> {
  await page.addInitScript(
    ({
      featureId,
      outputContent,
    }: {
      featureId: string;
      outputContent: string;
    }) => {
      const mockProject = {
        id: 'test-project-1',
        name: 'Test Project',
        path: '/mock/test-project',
        lastOpened: new Date().toISOString(),
      };

      const mockState = {
        state: {
          projects: [mockProject],
          currentProject: mockProject,
          theme: 'dark',
          sidebarOpen: true,
          apiKeys: { anthropic: '', google: '' },
          chatSessions: [],
          chatHistoryOpen: false,
          maxConcurrency: 3,
        },
        version: 2, // Must match app-store.ts persist version
      };

      localStorage.setItem('automaker-storage', JSON.stringify(mockState));

      // Set up mock file system with output content for the feature
      // Now uses features/{id}/agent-output.md path
      (window as any).__mockContextFile = {
        featureId,
        path: `/mock/test-project/.automaker/features/${featureId}/agent-output.md`,
        content: outputContent,
      };
    },
    { featureId, outputContent }
  );
}

/**
 * Set up a mock project with features that include waiting_approval status
 */
export async function setupMockProjectWithWaitingApprovalFeatures(
  page: Page,
  options?: {
    maxConcurrency?: number;
    runningTasks?: string[];
    features?: Array<{
      id: string;
      category: string;
      description: string;
      status: 'backlog' | 'in_progress' | 'waiting_approval' | 'verified';
      steps?: string[];
      startedAt?: string;
      skipTests?: boolean;
    }>;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockFeatures = opts?.features || [];

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: opts?.maxConcurrency ?? 3,
        isAutoModeRunning: false,
        runningAutoTasks: opts?.runningTasks ?? [],
        autoModeActivityLog: [],
        features: mockFeatures,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));

    // Also store features in a global variable that the mock electron API can use
    (window as any).__mockFeatures = mockFeatures;
  }, options);
}

/**
 * Set up the app store to show setup view (simulate first run)
 */
export async function setupFirstRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Clear any existing setup state to simulate first run
    localStorage.removeItem('automaker-setup');
    localStorage.removeItem('automaker-storage');

    // Set up the setup store state for first run
    const setupState = {
      state: {
        isFirstRun: true,
        setupComplete: false,
        currentStep: 'welcome',
        claudeCliStatus: null,
        claudeAuthStatus: null,
        claudeInstallProgress: {
          isInstalling: false,
          currentStep: '',
          progress: 0,
          output: [],
        },
        skipClaudeSetup: false,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-setup', JSON.stringify(setupState));

    // Also set up app store to show setup view
    const appState = {
      state: {
        projects: [],
        currentProject: null,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
        isAutoModeRunning: false,
        runningAutoTasks: [],
        autoModeActivityLog: [],
        currentView: 'setup',
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(appState));
  });
}

/**
 * Set up the app to skip the setup wizard (setup already complete)
 */
export async function setupComplete(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Mark setup as complete
    const setupState = {
      state: {
        isFirstRun: false,
        setupComplete: true,
        currentStep: 'complete',
        skipClaudeSetup: false,
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-setup', JSON.stringify(setupState));
  });
}

/**
 * Set up a mock project with AI profiles for testing the profiles view
 * Includes default built-in profiles and optionally custom profiles
 */
export async function setupMockProjectWithProfiles(
  page: Page,
  options?: {
    customProfilesCount?: number;
    includeBuiltIn?: boolean;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    // Default built-in profiles (same as DEFAULT_AI_PROFILES from app-store.ts)
    const builtInProfiles = [
      {
        id: 'profile-heavy-task',
        name: 'Heavy Task',
        description:
          'Claude Opus with Ultrathink for complex architecture, migrations, or deep debugging.',
        model: 'opus' as const,
        thinkingLevel: 'ultrathink' as const,
        provider: 'claude' as const,
        isBuiltIn: true,
        icon: 'Brain',
      },
      {
        id: 'profile-balanced',
        name: 'Balanced',
        description:
          'Claude Sonnet with medium thinking for typical development tasks.',
        model: 'sonnet' as const,
        thinkingLevel: 'medium' as const,
        provider: 'claude' as const,
        isBuiltIn: true,
        icon: 'Scale',
      },
      {
        id: 'profile-quick-edit',
        name: 'Quick Edit',
        description: 'Claude Haiku for fast, simple edits and minor fixes.',
        model: 'haiku' as const,
        thinkingLevel: 'none' as const,
        provider: 'claude' as const,
        isBuiltIn: true,
        icon: 'Zap',
      },
    ];

    // Generate custom profiles if requested
    const customProfiles = [];
    const customCount = opts?.customProfilesCount ?? 0;
    for (let i = 0; i < customCount; i++) {
      customProfiles.push({
        id: `custom-profile-${i + 1}`,
        name: `Custom Profile ${i + 1}`,
        description: `Test custom profile ${i + 1}`,
        model: ['haiku', 'sonnet', 'opus'][i % 3] as
          | 'haiku'
          | 'sonnet'
          | 'opus',
        thinkingLevel: ['none', 'low', 'medium', 'high'][i % 4] as
          | 'none'
          | 'low'
          | 'medium'
          | 'high',
        provider: 'claude' as const,
        isBuiltIn: false,
        icon: ['Brain', 'Zap', 'Scale', 'Cpu', 'Rocket', 'Sparkles'][i % 6],
      });
    }

    // Combine profiles (built-in first, then custom)
    const includeBuiltIn = opts?.includeBuiltIn !== false; // Default to true
    const aiProfiles = includeBuiltIn
      ? [...builtInProfiles, ...customProfiles]
      : customProfiles;

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '', openai: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
        aiProfiles: aiProfiles,
        features: [],
        currentView: 'board', // Start at board, will navigate to profiles
      },
      version: 2, // Must match app-store.ts persist version
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));

    // Also mark setup as complete to skip the setup wizard
    const setupState = {
      state: {
        isFirstRun: false,
        setupComplete: true,
        currentStep: 'complete',
        skipClaudeSetup: false,
      },
      version: 2, // Must match app-store.ts persist version
    };
    localStorage.setItem('automaker-setup', JSON.stringify(setupState));
  }, options);
}
