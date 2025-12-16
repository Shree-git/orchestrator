/**
 * POST /create-pr endpoint - Commit changes and create a pull request from a worktree
 */

import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { getErrorMessage, logError } from "../common.js";

const execAsync = promisify(exec);

// Extended PATH to include common tool installation locations
// This is needed because Electron apps don't inherit the user's shell PATH
const extendedPath = [
  process.env.PATH,
  "/opt/homebrew/bin",        // Homebrew on Apple Silicon
  "/usr/local/bin",           // Homebrew on Intel Mac, common Linux location
  "/home/linuxbrew/.linuxbrew/bin", // Linuxbrew
  `${process.env.HOME}/.local/bin`, // pipx, other user installs
].filter(Boolean).join(":");

const execEnv = {
  ...process.env,
  PATH: extendedPath,
};

export function createCreatePRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, commitMessage, prTitle, prBody, baseBranch, draft } = req.body as {
        worktreePath: string;
        commitMessage?: string;
        prTitle?: string;
        prBody?: string;
        baseBranch?: string;
        draft?: boolean;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: "worktreePath required",
        });
        return;
      }

      // Get current branch name
      const { stdout: branchOutput } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: worktreePath, env: execEnv }
      );
      const branchName = branchOutput.trim();

      // Check for uncommitted changes
      const { stdout: status } = await execAsync("git status --porcelain", {
        cwd: worktreePath,
        env: execEnv,
      });
      const hasChanges = status.trim().length > 0;

      // If there are changes, commit them
      let commitHash: string | null = null;
      if (hasChanges) {
        const message = commitMessage || `Changes from ${branchName}`;

        // Stage all changes
        await execAsync("git add -A", { cwd: worktreePath, env: execEnv });

        // Create commit
        await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
          cwd: worktreePath,
          env: execEnv,
        });

        // Get commit hash
        const { stdout: hashOutput } = await execAsync("git rev-parse HEAD", {
          cwd: worktreePath,
          env: execEnv,
        });
        commitHash = hashOutput.trim().substring(0, 8);
      }

      // Push the branch to remote
      let pushError: string | null = null;
      try {
        await execAsync(`git push -u origin ${branchName}`, {
          cwd: worktreePath,
          env: execEnv,
        });
      } catch (error: unknown) {
        // If push fails, try with --set-upstream
        try {
          await execAsync(`git push --set-upstream origin ${branchName}`, {
            cwd: worktreePath,
            env: execEnv,
          });
        } catch (error2: unknown) {
          // Capture push error for reporting
          const err = error2 as { stderr?: string; message?: string };
          pushError = err.stderr || err.message || "Push failed";
          console.error("[CreatePR] Push failed:", pushError);
        }
      }

      // If push failed, return error
      if (pushError) {
        res.status(500).json({
          success: false,
          error: `Failed to push branch: ${pushError}`,
        });
        return;
      }

      // Create PR using gh CLI or provide browser fallback
      const base = baseBranch || "main";
      const title = prTitle || branchName;
      const body = prBody || `Changes from branch ${branchName}`;
      const draftFlag = draft ? "--draft" : "";

      let prUrl: string | null = null;
      let prError: string | null = null;
      let browserUrl: string | null = null;
      let ghCliAvailable = false;

      // Check if gh CLI is available
      try {
        await execAsync("command -v gh", { env: execEnv });
        ghCliAvailable = true;
      } catch {
        ghCliAvailable = false;
      }

      // Get repository URL for browser fallback
      let repoUrl: string | null = null;
      let upstreamRepo: string | null = null;
      let originOwner: string | null = null;
      try {
        const { stdout: remotes } = await execAsync("git remote -v", {
          cwd: worktreePath,
          env: execEnv,
        });

        // Parse remotes to detect fork workflow and get repo URL
        const lines = remotes.split("\n");
        for (const line of lines) {
          const match = line.match(/^(\w+)\s+.*[:/]([^/]+)\/([^/\s]+?)(?:\.git)?\s+\(fetch\)/);
          if (match) {
            const [, remoteName, owner, repo] = match;
            if (remoteName === "upstream") {
              upstreamRepo = `${owner}/${repo}`;
              repoUrl = `https://github.com/${owner}/${repo}`;
            } else if (remoteName === "origin") {
              originOwner = owner;
              if (!repoUrl) {
                repoUrl = `https://github.com/${owner}/${repo}`;
              }
            }
          }
        }
      } catch {
        // Couldn't parse remotes
      }

      // Construct browser URL for PR creation
      if (repoUrl) {
        const encodedTitle = encodeURIComponent(title);
        const encodedBody = encodeURIComponent(body);

        if (upstreamRepo && originOwner) {
          // Fork workflow: PR to upstream from origin
          browserUrl = `https://github.com/${upstreamRepo}/compare/${base}...${originOwner}:${branchName}?expand=1&title=${encodedTitle}&body=${encodedBody}`;
        } else {
          // Regular repo
          browserUrl = `${repoUrl}/compare/${base}...${branchName}?expand=1&title=${encodedTitle}&body=${encodedBody}`;
        }
      }

      if (ghCliAvailable) {
        try {
          // Build gh pr create command
          let prCmd = `gh pr create --base "${base}"`;

          // If this is a fork (has upstream remote), specify the repo and head
          if (upstreamRepo && originOwner) {
            // For forks: --repo specifies where to create PR, --head specifies source
            prCmd += ` --repo "${upstreamRepo}" --head "${originOwner}:${branchName}"`;
          } else {
            // Not a fork, just specify the head branch
            prCmd += ` --head "${branchName}"`;
          }

          prCmd += ` --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" ${draftFlag}`;
          prCmd = prCmd.trim();

          console.log("[CreatePR] Running:", prCmd);
          const { stdout: prOutput } = await execAsync(prCmd, {
            cwd: worktreePath,
            env: execEnv,
          });
          prUrl = prOutput.trim();
        } catch (ghError: unknown) {
          // gh CLI failed
          const err = ghError as { stderr?: string; message?: string };
          prError = err.stderr || err.message || "PR creation failed";
          console.warn("[CreatePR] gh CLI error:", prError);
        }
      } else {
        prError = "gh_cli_not_available";
        console.log("[CreatePR] gh CLI not available, returning browser URL");
      }

      // Return result with browser fallback URL
      res.json({
        success: true,
        result: {
          branch: branchName,
          committed: hasChanges,
          commitHash,
          pushed: true,
          prUrl,
          prCreated: !!prUrl,
          prError: prError || undefined,
          browserUrl: browserUrl || undefined,
          ghCliAvailable,
        },
      });
    } catch (error) {
      logError(error, "Create PR failed");
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
