import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractText,
  generatePom,
  requireAnthropicKey,
  stripMarkdownFences,
} from "../src/generator.js";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

describe("stripMarkdownFences", () => {
  it("removes ```typescript fences", () => {
    const input = "```typescript\nexport const foo = 1;\n```";
    expect(stripMarkdownFences(input)).toBe("export const foo = 1;");
  });

  it("removes plain ``` fences", () => {
    const input = "```\nexport const foo = 1;\n```";
    expect(stripMarkdownFences(input)).toBe("export const foo = 1;");
  });

  it("removes ```ts fences", () => {
    const input = "```ts\nconst x = 2;\n```";
    expect(stripMarkdownFences(input)).toBe("const x = 2;");
  });

  it("returns text without fences unchanged", () => {
    const input = "export function createPage() {}";
    expect(stripMarkdownFences(input)).toBe("export function createPage() {}");
  });

  it("trims surrounding whitespace", () => {
    const input = "  \n  export const x = 1;\n  ";
    expect(stripMarkdownFences(input)).toBe("export const x = 1;");
  });
});

describe("extractText", () => {
  it("returns empty string for empty array", () => {
    expect(extractText([])).toBe("");
  });

  it("extracts text from a single text block", () => {
    const blocks = [{ type: "text", text: "hello" }];
    expect(extractText(blocks)).toBe("hello");
  });

  it("ignores non-text blocks", () => {
    const blocks = [{ type: "image" }, { type: "text", text: "hello" }, { type: "tool_use" }];
    expect(extractText(blocks)).toBe("hello");
  });

  it("concatenates multiple text blocks", () => {
    const blocks = [
      { type: "text", text: "foo" },
      { type: "text", text: "bar" },
    ];
    expect(extractText(blocks)).toBe("foobar");
  });

  it("ignores text blocks with undefined text", () => {
    const blocks = [{ type: "text" }, { type: "text", text: "ok" }];
    expect(extractText(blocks)).toBe("ok");
  });
});

describe("requireAnthropicKey", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  it("does not exit when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const spy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    expect(() => requireAnthropicKey()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it("exits with code 1 when ANTHROPIC_API_KEY is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    expect(() => requireAnthropicKey()).toThrow("process.exit called");
  });

  it("exits with code 1 when ANTHROPIC_API_KEY is empty string", () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    expect(() => requireAnthropicKey()).toThrow("process.exit called");
  });
});

describe("generatePom", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns stripped POM content from API response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "export function createHomePage(page: Page) { return {}; }" },
      ],
    });

    const result = await generatePom("snapshot yaml", "home");
    expect(result).toBe("export function createHomePage(page: Page) { return {}; }");
  });

  it("strips markdown fences from API response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "```typescript\nexport function createLoginPage() {}\n```",
        },
      ],
    });

    const result = await generatePom("snapshot yaml", "login");
    expect(result).toBe("export function createLoginPage() {}");
  });

  it("uses factory style by default", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "export function createPage() {}" }],
    });

    await generatePom("snapshot", "home");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("factory function"),
      }),
    );
  });

  it("uses class style when specified", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "export class HomePage {}" }],
    });

    await generatePom("snapshot", "home", "class");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("class pattern"),
      }),
    );
  });

  it("capitalizes and camelCases the name in prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "export function createCheckoutPage() {}" }],
    });

    await generatePom("snapshot", "checkout-page", "factory");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("CheckoutPage"),
          }),
        ]),
      }),
    );
  });
});
