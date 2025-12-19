/**
 * Auto Mode Concurrency End-to-End Test
 *
 * Tests that auto mode properly respects concurrency limits:
 * 1. Load backlog with 5 cards
 * 2. Set concurrency to 1
 * 3. Turn on auto mode
 * 4. Verify cards are processed one at a time
 *
 * NOTE: This test uses AUTOMAKER_MOCK_AGENT=true to mock the agent
 * so it doesn't make real API calls during CI/CD runs.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import {
  waitForNetworkIdle,
  createTestGitRepo,
  cleanupTempDir,
  createTempDirPath,
  setupProjectWithPathNoWorktrees,
  waitForBoardView,
  clickAddFeature,
  confirmAddFeature,
  setConcurrencyValue,
  getKanbanColumn,
} from "./utils";

// Create unique temp dir for this test run
const TEST_TEMP_DIR = createTempDirPath("auto-mode-concurrency-tests");

interface TestRepo {
  path: string;
  cleanup: () => Promise<void>;
}

// Configure all tests to run serially
test.describe.configure({ mode: "serial" });

test.describe("Auto Mode Concurrency Tests", () => {
  let testRepo: TestRepo;
  const featureIds: string[] = [];

  test.beforeAll(async () => {
    // Create test temp directory
    if (!fs.existsSync(TEST_TEMP_DIR)) {
      fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  test.beforeEach(async () => {
    // Create a fresh test repo for each test
    testRepo = await createTestGitRepo(TEST_TEMP_DIR);
    featureIds.length = 0; // Clear feature IDs array
  });

  test.afterEach(async () => {
    // Cleanup test repo after each test
    if (testRepo) {
      await testRepo.cleanup();
    }
  });

  test.afterAll(async () => {
    // Cleanup temp directory
    cleanupTempDir(TEST_TEMP_DIR);
  });

  test("auto mode processes cards one at a time with concurrency 1", async ({
    page,
  }) => {
    // Increase timeout for this comprehensive test (especially for CI)
    test.setTimeout(180000);

    // Helper function to read feature status from filesystem with retry
    const getFeatureStatus = async (featureId: string): Promise<string> => {
      const featurePath = path.join(
        testRepo.path,
        ".automaker",
        "features",
        featureId,
        "feature.json"
      );
      try {
        const content = fs.readFileSync(featurePath, "utf-8");
        const featureData = JSON.parse(content);
        return featureData.status;
      } catch {
        // File might not exist yet or be locked, return unknown status
        return "unknown";
      }
    };

    // Helper function to count features in a specific status
    const countFeaturesWithStatus = async (status: string): Promise<number> => {
      let count = 0;
      for (const featureId of featureIds) {
        const currentStatus = await getFeatureStatus(featureId);
        if (currentStatus === status) {
          count++;
        }
      }
      return count;
    };

    // ==========================================================================
    // Step 1: Setup and create 5 features in backlog
    // ==========================================================================
    await setupProjectWithPathNoWorktrees(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const featuresDir = path.join(testRepo.path, ".automaker", "features");

    // Create 5 features with small delays between to avoid race conditions
    const featureDescriptions = [
      "Create a file named test1.txt with content 'test1'",
      "Create a file named test2.txt with content 'test2'",
      "Create a file named test3.txt with content 'test3'",
      "Create a file named test4.txt with content 'test4'",
      "Create a file named test5.txt with content 'test5'",
    ];

    for (const description of featureDescriptions) {
      await clickAddFeature(page);
      const descriptionInput = page
        .locator('[data-testid="add-feature-dialog"] textarea')
        .first();
      await descriptionInput.fill(description);
      await confirmAddFeature(page);
      // Small delay to ensure filesystem writes complete
      await page.waitForTimeout(200);
    }

    // Wait for all features to be created in the filesystem with retry
    await expect(async () => {
      const dirs = fs.readdirSync(featuresDir);
      expect(dirs.length).toBe(5);
    }).toPass({ timeout: 15000 });

    // Get feature IDs
    const featureDirs = fs.readdirSync(featuresDir);
    featureIds.push(...featureDirs);
    expect(featureIds.length).toBe(5);

    // Reload to force features to load from filesystem
    await page.reload();
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Wait for all feature cards to appear on the board with retry
    for (const featureId of featureIds) {
      const featureCard = page.locator(
        `[data-testid="kanban-card-${featureId}"]`
      );
      await expect(featureCard).toBeVisible({ timeout: 20000 });
    }

    // Verify all features are initially in backlog
    await expect(async () => {
      const backlogCount = await countFeaturesWithStatus("backlog");
      expect(backlogCount).toBe(5);
    }).toPass({ timeout: 10000 });

    // ==========================================================================
    // Step 2: Set concurrency to 1
    // ==========================================================================
    await setConcurrencyValue(page, 1);

    // Verify concurrency is set to 1 with retry
    await expect(async () => {
      const concurrencyValue = await page
        .locator('[data-testid="concurrency-value"]')
        .textContent();
      expect(concurrencyValue).toBe("1");
    }).toPass({ timeout: 5000 });

    // ==========================================================================
    // Step 3: Turn on auto mode
    // ==========================================================================
    const autoModeToggle = page.locator('[data-testid="auto-mode-toggle"]');
    await expect(autoModeToggle).toBeVisible({ timeout: 10000 });

    // Check if toggle is already on, if not, turn it on
    const isChecked = await autoModeToggle.isChecked();
    if (!isChecked) {
      await autoModeToggle.click();
      // Wait for toggle to be checked
      await expect(autoModeToggle).toBeChecked({ timeout: 5000 });
    }

    // Wait for auto mode to actually start processing (verify a feature starts processing)
    await expect(async () => {
      const inProgressCount = await countFeaturesWithStatus("in_progress");
      const waitingApprovalCount = await countFeaturesWithStatus(
        "waiting_approval"
      );
      // At least one feature should have started processing or completed
      expect(inProgressCount + waitingApprovalCount).toBeGreaterThan(0);
    }).toPass({ timeout: 30000 });

    // ==========================================================================
    // Step 4: Verify cards are processed one at a time
    // ==========================================================================
    // Track processed features
    const processedFeatureIds = new Set<string>();
    const maxWaitTime = 120000; // Maximum time to wait for all features (2 minutes)
    const startTime = Date.now();

    while (
      processedFeatureIds.size < featureIds.length &&
      Date.now() - startTime < maxWaitTime
    ) {
      // Get current state from filesystem (more reliable than UI)
      const inProgressCount = await countFeaturesWithStatus("in_progress");
      const waitingApprovalCount = await countFeaturesWithStatus(
        "waiting_approval"
      );

      // With concurrency 1, there should be at most 1 feature in_progress at a time
      expect(inProgressCount).toBeLessThanOrEqual(1);

      // If there's a feature in_progress, wait for it to complete
      if (inProgressCount === 1) {
        // Find which feature is in_progress
        let currentFeatureId: string | null = null;
        for (const featureId of featureIds) {
          if (
            (await getFeatureStatus(featureId)) === "in_progress" &&
            !processedFeatureIds.has(featureId)
          ) {
            currentFeatureId = featureId;
            break;
          }
        }

        if (currentFeatureId) {
          // Wait for this feature to move to waiting_approval
          await expect(async () => {
            const status = await getFeatureStatus(currentFeatureId!);
            expect(status).toBe("waiting_approval");
          }).toPass({ timeout: 60000 });

          processedFeatureIds.add(currentFeatureId);

          // Small delay before checking for next feature
          await page.waitForTimeout(500);
        } else {
          // Feature might have completed between checks, wait a bit
          await page.waitForTimeout(500);
        }
      } else if (waitingApprovalCount === featureIds.length) {
        // All features are done
        break;
      } else {
        // No features in_progress, but not all are done yet
        // Wait for auto mode to pick up the next feature
        await page.waitForTimeout(1000);
      }
    }

    // Verify all features were processed
    expect(processedFeatureIds.size).toBe(featureIds.length);

    // Final verification: all features should be in waiting_approval
    await expect(async () => {
      const waitingApprovalCount = await countFeaturesWithStatus(
        "waiting_approval"
      );
      expect(waitingApprovalCount).toBe(featureIds.length);
    }).toPass({ timeout: 30000 });

    // Verify in the UI that all features are in waiting_approval column
    await page.reload();
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const waitingApprovalColumn = await getKanbanColumn(
      page,
      "waiting_approval"
    );
    for (const featureId of featureIds) {
      const card = waitingApprovalColumn.locator(
        `[data-testid="kanban-card-${featureId}"]`
      );
      await expect(card).toBeVisible({ timeout: 20000 });
    }
  });
});
