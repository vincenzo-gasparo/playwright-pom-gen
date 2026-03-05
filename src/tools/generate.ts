import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runBrowserSession } from "../browser.js";
import { generatePom } from "../generator.js";
import { writePom, writeSnapshot } from "../snapshot.js";

const inputSchema = z.object({
  url: z.url().describe("Starting URL to navigate to"),
  name: z
    .string()
    .regex(/^[a-z0-9_-]+$/i)
    .describe('Output name (e.g. "checkout" → checkout.page.ts + checkout.snapshot.yml)'),
  outputDir: z.string().describe("Directory to write generated files into"),
  waitForUrl: z
    .string()
    .optional()
    .describe(
      "URL glob pattern; when set the browser launches headed so you can manually navigate first",
    ),
  timeout: z.number().default(120_000).describe("Milliseconds to wait for waitForUrl"),
  style: z
    .enum(["factory", "class"])
    .optional()
    .default("factory")
    .describe("POM style: factory function (default) or class-based"),
});

type GeneratePomInput = z.infer<typeof inputSchema>;

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    "generate_pom",
    {
      title: "Generate POM",
      description:
        "Generate a functional Page Object Model TypeScript file from a live Playwright accessibility snapshot. Optionally launches a headed browser so you can log in or navigate to the desired state first.",
      inputSchema,
    },
    async (input: GeneratePomInput) => {
      try {
        const { url, name, outputDir, waitForUrl, timeout, style } = input;

        const { snapshotYaml } = await runBrowserSession({
          url,
          headed: !!waitForUrl,
          waitForUrl,
          timeout,
        });

        const snapshotPath = join(outputDir, `${name}.snapshot.yml`);
        const pomPath = join(outputDir, `${name}.page.ts`);

        await writeSnapshot(snapshotPath, snapshotYaml);

        const pomContent = await generatePom(snapshotYaml, name, style);
        await writePom(pomPath, pomContent);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `✅ POM generated successfully`,
                ``,
                `📄 POM file:      ${pomPath}`,
                `📸 Snapshot file: ${snapshotPath}`,
                ``,
                `--- Generated POM ---`,
                pomContent,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `generate_pom failed: ${message}` }],
        };
      }
    },
  );
}
