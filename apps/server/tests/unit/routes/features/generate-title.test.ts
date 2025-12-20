import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { createGenerateTitleHandler } from "@/routes/features/routes/generate-title.js";
import { FeatureLoader } from "@/services/feature-loader.js";

// Mock the query function from claude-agent-sdk
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

// Mock the logger
vi.mock("@/lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("generate-title.ts", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockFeatureLoader: Partial<FeatureLoader>;
  let resJsonMock: ReturnType<typeof vi.fn>;
  let resStatusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    resJsonMock = vi.fn();
    resStatusMock = vi.fn().mockReturnValue({ json: resJsonMock });

    mockReq = {
      body: {
        projectPath: "/test/project",
        featureId: "feature-123",
        description: "Add dark mode theme support",
      },
    };

    mockRes = {
      json: resJsonMock,
      status: resStatusMock,
    };

    mockFeatureLoader = {
      update: vi.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("should return 400 when projectPath is missing", async () => {
      mockReq.body = { featureId: "feature-123", description: "test" };

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(400);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "projectPath is required and must be a string",
      });
    });

    it("should return 400 when featureId is missing", async () => {
      mockReq.body = { projectPath: "/test", description: "test" };

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(400);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "featureId is required and must be a string",
      });
    });

    it("should return 400 when description is missing", async () => {
      mockReq.body = { projectPath: "/test", featureId: "feature-123" };

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(400);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "description is required and must be a string",
      });
    });

    it("should return 400 when description is empty", async () => {
      mockReq.body = {
        projectPath: "/test",
        featureId: "feature-123",
        description: "   ",
      };

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(400);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "description cannot be empty",
      });
    });

    it("should return 400 when projectPath is not a string", async () => {
      mockReq.body = {
        projectPath: 123,
        featureId: "feature-123",
        description: "test",
      };

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(400);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "projectPath is required and must be a string",
      });
    });
  });

  describe("successful title generation", () => {
    it("should generate title and update feature", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      // Mock the async iterable response
      (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "result",
            subtype: "success",
            result: "Dark Mode Theme Support",
          };
        },
      });

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resJsonMock).toHaveBeenCalledWith({
        success: true,
        title: "Dark Mode Theme Support",
      });

      expect(mockFeatureLoader.update).toHaveBeenCalledWith(
        "/test/project",
        "feature-123",
        { title: "Dark Mode Theme Support" }
      );
    });

    it("should strip quotes from generated title", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "result",
            subtype: "success",
            result: '"Dark Mode Support"',
          };
        },
      });

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resJsonMock).toHaveBeenCalledWith({
        success: true,
        title: "Dark Mode Support",
      });
    });

    it("should handle assistant message content type", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "assistant",
            message: {
              content: [
                { type: "text", text: "CSV Data Export" },
              ],
            },
          };
        },
      });

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resJsonMock).toHaveBeenCalledWith({
        success: true,
        title: "CSV Data Export",
      });
    });
  });

  describe("error handling", () => {
    it("should return 500 when title generation fails with empty response", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "result",
            subtype: "success",
            result: "",
          };
        },
      });

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(500);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to generate title - empty response",
      });
    });

    it("should return 500 when query throws an error", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      (query as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("API error");
      });

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      expect(resStatusMock).toHaveBeenCalledWith(500);
      expect(resJsonMock).toHaveBeenCalledWith({
        success: false,
        error: "API error",
      });
    });

    it("should still return success even if feature update fails", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      (query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "result",
            subtype: "success",
            result: "Generated Title",
          };
        },
      });

      mockFeatureLoader.update = vi.fn().mockRejectedValue(new Error("Update failed"));

      const handler = createGenerateTitleHandler(
        mockFeatureLoader as FeatureLoader
      );
      await handler(mockReq as Request, mockRes as Response);

      // Should still return success with the title
      expect(resJsonMock).toHaveBeenCalledWith({
        success: true,
        title: "Generated Title",
      });
    });
  });
});
