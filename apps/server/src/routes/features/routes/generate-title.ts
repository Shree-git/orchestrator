/**
 * POST /generate-title endpoint - Generate a haiku title for a feature
 *
 * Uses Claude Haiku to generate a short, poetic title based on the feature description.
 */

import type { Request, Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createLogger } from "../../../lib/logger.js";
import { FeatureLoader } from "../../../services/feature-loader.js";
import { CLAUDE_MODEL_MAP } from "../../../lib/model-resolver.js";

const logger = createLogger("GenerateTitle");

/**
 * System prompt for generating concise haiku-style titles
 */
const TITLE_SYSTEM_PROMPT = `You are an expert at creating short, evocative titles for software features.

Your task is to take a feature description and generate a concise title (3-7 words) that captures the essence of the feature.

Guidelines:
- Keep it SHORT: 3-7 words maximum
- Make it DESCRIPTIVE: Capture the core purpose
- Use ACTION words when appropriate (Add, Create, Fix, Improve, etc.)
- Be SPECIFIC: Avoid generic titles like "New Feature" or "Update"
- NO punctuation at the end
- NO quotes around the title

Examples:
- "Add dark mode theme support" -> "Dark Mode Theme Support"
- "Fix login authentication bug" -> "Fix Login Auth Flow"
- "Implement user profile page with avatar upload" -> "User Profile with Avatars"
- "Make the search faster" -> "Optimize Search Performance"
- "Add ability to export data to CSV" -> "CSV Data Export"

Output ONLY the title, nothing else. No explanations, no quotes, no punctuation.`;

/**
 * Request body for the generate-title endpoint
 */
interface GenerateTitleRequestBody {
  /** The project path */
  projectPath: string;
  /** The feature ID to update with the generated title */
  featureId: string;
  /** The feature description to generate a title from */
  description: string;
}

/**
 * Success response from the generate-title endpoint
 */
interface GenerateTitleSuccessResponse {
  success: true;
  title: string;
}

/**
 * Error response from the generate-title endpoint
 */
interface GenerateTitleErrorResponse {
  success: false;
  error: string;
}

/**
 * Extract text content from Claude SDK response messages
 */
async function extractTextFromStream(
  stream: AsyncIterable<{
    type: string;
    subtype?: string;
    result?: string;
    message?: {
      content?: Array<{ type: string; text?: string }>;
    };
  }>
): Promise<string> {
  let responseText = "";

  for await (const msg of stream) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text) {
          responseText += block.text;
        }
      }
    } else if (msg.type === "result" && msg.subtype === "success") {
      responseText = msg.result || responseText;
    }
  }

  return responseText;
}

/**
 * Create the generate-title request handler
 */
export function createGenerateTitleHandler(
  featureLoader: FeatureLoader
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, featureId, description } =
        req.body as GenerateTitleRequestBody;

      // Validate required fields
      if (!projectPath || typeof projectPath !== "string") {
        const response: GenerateTitleErrorResponse = {
          success: false,
          error: "projectPath is required and must be a string",
        };
        res.status(400).json(response);
        return;
      }

      if (!featureId || typeof featureId !== "string") {
        const response: GenerateTitleErrorResponse = {
          success: false,
          error: "featureId is required and must be a string",
        };
        res.status(400).json(response);
        return;
      }

      if (!description || typeof description !== "string") {
        const response: GenerateTitleErrorResponse = {
          success: false,
          error: "description is required and must be a string",
        };
        res.status(400).json(response);
        return;
      }

      // Validate description is not empty
      const trimmedDescription = description.trim();
      if (trimmedDescription.length === 0) {
        const response: GenerateTitleErrorResponse = {
          success: false,
          error: "description cannot be empty",
        };
        res.status(400).json(response);
        return;
      }

      logger.info(
        `Generating title for feature ${featureId}, description length: ${trimmedDescription.length} chars`
      );

      // Call Claude Haiku for fast, cheap title generation
      const stream = query({
        prompt: `Generate a short title (3-7 words) for this feature:\n\n${trimmedDescription}`,
        options: {
          model: CLAUDE_MODEL_MAP.haiku,
          systemPrompt: TITLE_SYSTEM_PROMPT,
          maxTurns: 1,
          allowedTools: [],
          permissionMode: "acceptEdits",
        },
      });

      // Extract the title from the response
      const title = await extractTextFromStream(stream);

      if (!title || title.trim().length === 0) {
        logger.warn("Received empty response from Claude");
        const response: GenerateTitleErrorResponse = {
          success: false,
          error: "Failed to generate title - empty response",
        };
        res.status(500).json(response);
        return;
      }

      // Clean up the title (remove quotes if present, trim whitespace)
      const cleanTitle = title.trim().replace(/^["']|["']$/g, "");

      logger.info(`Generated title: "${cleanTitle}" for feature ${featureId}`);

      // Update the feature with the generated title
      try {
        await featureLoader.update(projectPath, featureId, { title: cleanTitle });
        logger.info(`Updated feature ${featureId} with title`);
      } catch (updateError) {
        logger.warn(`Failed to update feature with title: ${updateError}`);
        // Still return success with the title, even if update failed
      }

      const response: GenerateTitleSuccessResponse = {
        success: true,
        title: cleanTitle,
      };
      res.json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("Title generation failed:", errorMessage);

      const response: GenerateTitleErrorResponse = {
        success: false,
        error: errorMessage,
      };
      res.status(500).json(response);
    }
  };
}
