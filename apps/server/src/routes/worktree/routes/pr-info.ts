/**
 * POST /pr-info endpoint - Get PR info and comments for a branch
 */

import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { getErrorMessage, logError } from "../common.js";

const execAsync = promisify(exec);

// Extended PATH to include common tool installation locations
const pathSeparator = process.platform === "win32" ? ";" : ":";
const additionalPaths: string[] = [];

if (process.platform === "win32") {
  if (process.env.LOCALAPPDATA) {
    additionalPaths.push(`${process.env.LOCALAPPDATA}\\Programs\\Git\\cmd`);
  }
  if (process.env.PROGRAMFILES) {
    additionalPaths.push(`${process.env.PROGRAMFILES}\\Git\\cmd`);
  }
  if (process.env["ProgramFiles(x86)"]) {
    additionalPaths.push(`${process.env["ProgramFiles(x86)"]}\\Git\\cmd`);
  }
} else {
  additionalPaths.push(
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/home/linuxbrew/.linuxbrew/bin",
    `${process.env.HOME}/.local/bin`,
  );
}

const extendedPath = [
  process.env.PATH,
  ...additionalPaths.filter(Boolean),
].filter(Boolean).join(pathSeparator);

const execEnv = {
  ...process.env,
  PATH: extendedPath,
};

/**
 * Validate branch name to prevent command injection.
 * Git branch names cannot contain: space, ~, ^, :, ?, *, [, \, or control chars.
 * We also reject shell metacharacters for safety.
 */
function isValidBranchName(name: string): boolean {
  return /^[a-zA-Z0-9._\-/]+$/.test(name) && name.length < 250;
}

export interface PRComment {
  id: number;
  author: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
  isReviewComment: boolean;
}

export interface PRInfo {
  number: number;
  title: string;
  url: string;
  state: string;
  author: string;
  body: string;
  comments: PRComment[];
  reviewComments: PRComment[];
}

export function createPRInfoHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, branchName } = req.body as {
        worktreePath: string;
        branchName: string;
      };

      if (!worktreePath || !branchName) {
        res.status(400).json({
          success: false,
          error: "worktreePath and branchName required",
        });
        return;
      }

      // Validate branch name to prevent command injection
      if (!isValidBranchName(branchName)) {
        res.status(400).json({
          success: false,
          error: "Invalid branch name contains unsafe characters",
        });
        return;
      }

      // Check if gh CLI is available
      let ghCliAvailable = false;
      try {
        const checkCommand = process.platform === "win32"
          ? "where gh"
          : "command -v gh";
        await execAsync(checkCommand, { env: execEnv });
        ghCliAvailable = true;
      } catch {
        ghCliAvailable = false;
      }

      if (!ghCliAvailable) {
        res.json({
          success: true,
          result: {
            hasPR: false,
            ghCliAvailable: false,
            error: "gh CLI not available",
          },
        });
        return;
      }

      // Detect repository information (supports fork workflows)
      let upstreamRepo: string | null = null;
      let originOwner: string | null = null;
      let originRepo: string | null = null;

      try {
        const { stdout: remotes } = await execAsync("git remote -v", {
          cwd: worktreePath,
          env: execEnv,
        });

        const lines = remotes.split(/\r?\n/);
        for (const line of lines) {
          let match =
            line.match(
              /^(\w+)\s+.*[:/]([^/]+)\/([^/\s]+?)(?:\.git)?\s+\(fetch\)/
            ) ||
            line.match(
              /^(\w+)\s+git@[^:]+:([^/]+)\/([^\s]+?)(?:\.git)?\s+\(fetch\)/
            ) ||
            line.match(
              /^(\w+)\s+https?:\/\/[^/]+\/([^/]+)\/([^\s]+?)(?:\.git)?\s+\(fetch\)/
            );

          if (match) {
            const [, remoteName, owner, repo] = match;
            if (remoteName === "upstream") {
              upstreamRepo = `${owner}/${repo}`;
            } else if (remoteName === "origin") {
              originOwner = owner;
              originRepo = repo;
            }
          }
        }
      } catch {
        // Ignore remote parsing errors
      }

      if (!originOwner || !originRepo) {
        try {
          const { stdout: originUrl } = await execAsync(
            "git config --get remote.origin.url",
            {
              cwd: worktreePath,
              env: execEnv,
            }
          );
          const match = originUrl
            .trim()
            .match(/[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/);
          if (match) {
            if (!originOwner) {
              originOwner = match[1];
            }
            if (!originRepo) {
              originRepo = match[2];
            }
          }
        } catch {
          // Ignore fallback errors
        }
      }

      const targetRepo =
        upstreamRepo || (originOwner && originRepo
          ? `${originOwner}/${originRepo}`
          : null);
      const repoFlag = targetRepo ? ` --repo "${targetRepo}"` : "";
      const headRef =
        upstreamRepo && originOwner ? `${originOwner}:${branchName}` : branchName;

      // Get PR info for the branch using gh CLI
      try {
        // First, find the PR associated with this branch
        const listCmd = `gh pr list${repoFlag} --head "${headRef}" --json number,title,url,state,author,body --limit 1`;
        const { stdout: prListOutput } = await execAsync(
          listCmd,
          { cwd: worktreePath, env: execEnv }
        );

        const prList = JSON.parse(prListOutput);

        if (prList.length === 0) {
          res.json({
            success: true,
            result: {
              hasPR: false,
              ghCliAvailable: true,
            },
          });
          return;
        }

        const pr = prList[0];
        const prNumber = pr.number;

        // Get regular PR comments (issue comments)
        let comments: PRComment[] = [];
        try {
          const viewCmd = `gh pr view ${prNumber}${repoFlag} --json comments`;
          const { stdout: commentsOutput } = await execAsync(
            viewCmd,
            { cwd: worktreePath, env: execEnv }
          );
          const commentsData = JSON.parse(commentsOutput);
          comments = (commentsData.comments || []).map((c: {
            id: number;
            author: { login: string };
            body: string;
            createdAt: string;
          }) => ({
            id: c.id,
            author: c.author?.login || "unknown",
            body: c.body,
            createdAt: c.createdAt,
            isReviewComment: false,
          }));
        } catch (error) {
          console.warn("[PRInfo] Failed to fetch PR comments:", error);
        }

        // Get review comments (inline code comments)
        let reviewComments: PRComment[] = [];
        // Only fetch review comments if we have repository info
        if (targetRepo) {
          try {
            const reviewsEndpoint = `repos/${targetRepo}/pulls/${prNumber}/comments`;
            const reviewsCmd = `gh api ${reviewsEndpoint}`;
            const { stdout: reviewsOutput } = await execAsync(
              reviewsCmd,
              { cwd: worktreePath, env: execEnv }
            );
            const reviewsData = JSON.parse(reviewsOutput);
            reviewComments = reviewsData.map((c: {
              id: number;
              user: { login: string };
              body: string;
              path: string;
              line?: number;
              original_line?: number;
              created_at: string;
            }) => ({
              id: c.id,
              author: c.user?.login || "unknown",
              body: c.body,
              path: c.path,
              line: c.line || c.original_line,
              createdAt: c.created_at,
              isReviewComment: true,
            }));
          } catch (error) {
            console.warn("[PRInfo] Failed to fetch review comments:", error);
          }
        } else {
          console.warn("[PRInfo] Cannot fetch review comments: repository info not available");
        }

        const prInfo: PRInfo = {
          number: prNumber,
          title: pr.title,
          url: pr.url,
          state: pr.state,
          author: pr.author?.login || "unknown",
          body: pr.body || "",
          comments,
          reviewComments,
        };

        res.json({
          success: true,
          result: {
            hasPR: true,
            ghCliAvailable: true,
            prInfo,
          },
        });
      } catch (error) {
        // gh CLI failed - might not be authenticated or no remote
        logError(error, "Failed to get PR info");
        res.json({
          success: true,
          result: {
            hasPR: false,
            ghCliAvailable: true,
            error: getErrorMessage(error),
          },
        });
      }
    } catch (error) {
      logError(error, "PR info handler failed");
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
