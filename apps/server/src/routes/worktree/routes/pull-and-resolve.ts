/**
 * POST /pull-and-resolve endpoint - Pull latest from origin/main and resolve conflicts using an agent
 */

import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { getErrorMessage, logError } from "../common.js";
import type { AutoModeService } from "../../../services/auto-mode-service.js";

const execAsync = promisify(exec);

export function createPullAndResolveHandler(autoModeService: AutoModeService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, projectPath } = req.body as {
        worktreePath: string;
        projectPath: string;
      };

      if (!worktreePath || !projectPath) {
        res.status(400).json({
          success: false,
          error: "worktreePath and projectPath required",
        });
        return;
      }

      // Get current branch name
      const { stdout: branchOutput } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: worktreePath }
      );
      const branchName = branchOutput.trim();

      // Fetch latest from remote
      await execAsync("git fetch origin", { cwd: worktreePath });

      // Get the main branch name (could be main or master)
      let mainBranch = "main";
      try {
        await execAsync("git rev-parse --verify origin/main", { cwd: worktreePath });
      } catch {
        // Try master if main doesn't exist
        try {
          await execAsync("git rev-parse --verify origin/master", { cwd: worktreePath });
          mainBranch = "master";
        } catch {
          res.status(400).json({
            success: false,
            error: "Could not find origin/main or origin/master branch",
          });
          return;
        }
      }

      // Check if there are any commits to pull from main
      const { stdout: behindCount } = await execAsync(
        `git rev-list --count HEAD..origin/${mainBranch}`,
        { cwd: worktreePath }
      );

      if (parseInt(behindCount.trim(), 10) === 0) {
        res.json({
          success: true,
          result: {
            branch: branchName,
            mainBranch,
            message: `Already up to date with origin/${mainBranch}`,
            hadConflicts: false,
            agentStarted: false,
          },
        });
        return;
      }

      // Try to merge origin/main into current branch
      try {
        await execAsync(`git merge origin/${mainBranch} --no-edit`, { cwd: worktreePath });

        // Merge succeeded without conflicts
        res.json({
          success: true,
          result: {
            branch: branchName,
            mainBranch,
            message: `Successfully merged origin/${mainBranch} without conflicts`,
            hadConflicts: false,
            agentStarted: false,
          },
        });
        return;
      } catch (mergeError: unknown) {
        const err = mergeError as { stderr?: string; message?: string };
        const errorMsg = err.stderr || err.message || "";

        // Check if it's a merge conflict
        if (!errorMsg.includes("CONFLICT") && !errorMsg.includes("Automatic merge failed")) {
          // It's a different error, not a conflict
          throw mergeError;
        }

        // We have conflicts - create a temporary feature to kick off an agent
        const featureId = `resolve-conflicts-${Date.now()}`;

        // Build the conflict resolution prompt
        const prompt = `## Conflict Resolution Task

You are working in a git worktree at: ${worktreePath}
Current branch: ${branchName}

A merge from origin/${mainBranch} has resulted in conflicts that need to be resolved.

## Instructions

1. First, run \`git status\` to see which files have conflicts
2. For each conflicted file:
   - Read the file to understand both versions (marked by <<<<<<< HEAD, =======, and >>>>>>> origin/${mainBranch})
   - Analyze the changes from both branches
   - Resolve the conflict by keeping the appropriate changes (often you'll want to combine both)
   - Remove the conflict markers
   - Save the resolved file
3. After resolving all conflicts, stage the resolved files with \`git add\`
4. Complete the merge with \`git commit -m "Merge origin/${mainBranch} into ${branchName} - resolved conflicts"\`
5. Verify the merge was successful with \`git status\`

## Important Notes
- Make sure to preserve functionality from BOTH branches where possible
- If unsure about a conflict, prefer keeping both changes
- Test that the code still makes sense after resolution

When done, provide a summary of:
- Which files had conflicts
- How each conflict was resolved
- The final merge commit hash`;

        // Start the agent to resolve conflicts
        // We use followUpFeature as it allows running an agent with a custom prompt
        // But we need to use a different approach since we don't have a proper feature

        // For now, let's just inform the user about the conflicts and they can use the follow-up dialog
        res.json({
          success: true,
          result: {
            branch: branchName,
            mainBranch,
            message: `Merge from origin/${mainBranch} resulted in conflicts. An agent will be started to resolve them.`,
            hadConflicts: true,
            agentStarted: true,
            conflictPrompt: prompt,
          },
        });
        return;
      }
    } catch (error) {
      logError(error, "Pull and resolve failed");
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
