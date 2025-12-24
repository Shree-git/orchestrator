import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

export const router = Router();

interface DiscoveredFile {
  path: string;
  type: 'readme' | 'package' | 'config' | 'docs' | 'source';
  relevanceScore: number;
}

// File patterns and their types
const FILE_PATTERNS = {
  readme: [/readme\.md$/i, /readme\.txt$/i, /readme$/i],
  package: [
    /package\.json$/i,
    /cargo\.toml$/i,
    /pyproject\.toml$/i,
    /pom\.xml$/i,
    /build\.gradle$/i,
  ],
  config: [
    /\.env\.example$/i,
    /config\..*$/i,
    /settings\..*$/i,
    /\.gitignore$/i,
    /\.editorconfig$/i,
  ],
  docs: [/docs?\/.*\.md$/i, /\.md$/i, /changelog\.md$/i, /contributing\.md$/i, /license\.md$/i],
  source: [/\.ts$/i, /\.tsx$/i, /\.js$/i, /\.jsx$/i, /\.py$/i, /\.rs$/i, /\.go$/i, /\.java$/i],
};

// Calculate relevance score based on file type and location
function calculateRelevanceScore(filePath: string, projectPath: string): number {
  const relativePath = path.relative(projectPath, filePath);
  const fileName = path.basename(filePath).toLowerCase();

  // Higher score for files in root directory
  const depth = relativePath.split(path.sep).length;
  let score = Math.max(100 - depth * 10, 10);

  // Boost scores for important files
  if (fileName.includes('readme')) score += 50;
  if (fileName === 'package.json') score += 40;
  if (fileName.includes('config')) score += 30;
  if (fileName.includes('changelog') || fileName.includes('contributing')) score += 25;
  if (fileName.includes('license')) score += 20;

  // Penalize files in common ignore directories
  if (
    relativePath.includes('node_modules') ||
    relativePath.includes('.git') ||
    relativePath.includes('dist') ||
    relativePath.includes('build') ||
    relativePath.includes('.next') ||
    relativePath.includes('target')
  ) {
    score = 0;
  }

  return Math.min(score, 100);
}

// Determine file type based on patterns
function getFileType(filePath: string): DiscoveredFile['type'] | null {
  const relativePath = path.relative('.', filePath);

  for (const [type, patterns] of Object.entries(FILE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(relativePath) || pattern.test(path.basename(filePath))) {
        return type as DiscoveredFile['type'];
      }
    }
  }

  return null;
}

// Recursively discover files
async function discoverFiles(directory: string, projectPath: string): Promise<DiscoveredFile[]> {
  const discoveries: DiscoveredFile[] = [];

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (
          ['node_modules', '.git', 'dist', 'build', '.next', 'target', 'vendor'].includes(
            entry.name
          )
        ) {
          continue;
        }

        // Recursively discover in subdirectories (limit depth)
        const relativePath = path.relative(projectPath, fullPath);
        if (relativePath.split(path.sep).length <= 3) {
          const subDiscoveries = await discoverFiles(fullPath, projectPath);
          discoveries.push(...subDiscoveries);
        }
      } else if (entry.isFile()) {
        const fileType = getFileType(fullPath);
        if (fileType) {
          const relevanceScore = calculateRelevanceScore(fullPath, projectPath);

          if (relevanceScore > 0) {
            discoveries.push({
              path: fullPath,
              type: fileType,
              relevanceScore,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error discovering files in', directory, ':', error);
  }

  return discoveries;
}

// POST /api/context-files/auto-discover
router.post('/auto-discover', async (req: Request, res: Response) => {
  try {
    const { projectPath } = req.body;

    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Project path is required',
      });
    }

    // Check if project directory exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Project path does not exist',
      });
    }

    // Discover files
    const discoveredFiles = await discoverFiles(projectPath, projectPath);

    // Sort by relevance score (highest first) and limit results
    const sortedFiles = discoveredFiles
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20); // Limit to top 20 most relevant files

    return res.json({
      success: true,
      files: sortedFiles,
    });
  } catch (error) {
    console.error('Error in context files auto-discover:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-discover context files',
    });
  }
});
