import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

/**
 * Ensures ANTHROPIC_API_KEY is set. Call at startup or before first API use.
 * Exits the process with a clear message if the key is missing (no stack trace).
 */
export function requireAnthropicKey(): void {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) {
    console.error("ANTHROPIC_API_KEY is not set. Set it in your environment or .env file.");
    process.exit(1);
  }
}

const FACTORY_SYSTEM_PROMPT = `You are an expert Playwright test automation engineer. Your task is to generate well-structured, functional Page Object Models (POMs) in TypeScript.

Rules for generated POMs:
- Use factory functions (not classes): export a function named \`create<Name>Page(page: Page)\` that returns an object
- Expose a \`locators\` object containing all meaningful interactive and landmark elements using semantic locators
- Use semantic locators in priority order: getByRole > getByLabel > getByPlaceholder > getByText > getByTestId > locator(css)
- Action methods return \`Promise<void>\` and are async
- Add JSDoc comments to the factory function and each method
- Import only what is needed from \`playwright\`
- Do NOT use classes, inheritance, or constructor patterns
- Do NOT include test code or test imports
- At the very end of the file, export an inferred type using \`ReturnType<typeof create<Name>Page>\` with a JSDoc comment, e.g.: \`/** Inferred type of the home page object. */\nexport type HomePage = ReturnType<typeof createHomePage>;\`
- Output raw TypeScript only — no markdown fences, no explanation text`;

const CLASS_SYSTEM_PROMPT = `You are an expert Playwright test automation engineer. Your task is to generate well-structured, functional Page Object Models (POMs) in TypeScript using the class pattern.

Rules for generated POMs:
- Use a class named \`<Name>Page\` (e.g., \`createCheckoutPage\` → \`CheckoutPage\`)
- Declare all meaningful interactive and landmark elements as \`readonly\` class properties using semantic locators
- Use semantic locators in priority order: getByRole > getByLabel > getByPlaceholder > getByText > getByTestId > locator(css)
- Add a constructor: \`constructor(readonly page: Page) {}\`
- Include an async \`goto(url: string)\` method that navigates to the page URL
- Action methods are async and return \`Promise<void>\`
- Import \`expect, type Locator, type Page\` from \`@playwright/test\`
- Do NOT use factory functions or return-object patterns
- Do NOT include test code outside the class
- Output raw TypeScript only — no markdown fences, no explanation text`;

/**
 * Generate a full functional POM TypeScript file from an accessibility snapshot.
 */
export async function generatePom(
  snapshotYaml: string,
  name: string,
  style: "factory" | "class" = "factory",
): Promise<string> {
  const capitalized =
    name.charAt(0).toUpperCase() +
    name.slice(1).replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: style === "class" ? CLASS_SYSTEM_PROMPT : FACTORY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a complete functional Page Object Model for the "${name}" page.

${style === "class" ? `The class must be named \`${capitalized}Page\`.` : `The factory function must be named \`create${capitalized}Page\`.`}

Here is the accessibility snapshot of the page:

\`\`\`yaml
${snapshotYaml}
\`\`\`

Output only the raw TypeScript file content with no markdown fences or explanation.`,
      },
    ],
  });

  const text = extractText(message.content as Array<{ type: string; text?: string }>);
  return stripMarkdownFences(text);
}

export function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("");
}

export function stripMarkdownFences(text: string): string {
  // Remove leading ```typescript or ``` fences and trailing ```
  return text
    .replace(/^```(?:typescript|ts)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}
