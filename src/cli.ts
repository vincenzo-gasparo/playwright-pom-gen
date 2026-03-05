#!/usr/bin/env node
import { join } from "node:path";
import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import { createBrowserSession, takeSnapshot } from "./browser.js";
import { generatePom, requireAnthropicKey } from "./generator.js";
import { writePom, writeSnapshot } from "./snapshot.js";

const program = new Command();

program
  .name("pom-gen")
  .description(
    "Interactive CLI to generate Playwright Page Object Models from a live headed browser",
  )
  .argument(
    "[url]",
    "URL to open in the browser (default: about:blank — paste URL in the address bar)",
    "about:blank",
  )
  .option("-n, --name <name>", "Page name (prompted if omitted)")
  .option("-o, --output <dir>", "Output directory for generated files")
  .option("--class", "Generate a class-based POM instead of the default factory function style")
  .action(async (url: string, opts: { name?: string; output?: string; class?: boolean }) => {
    requireAnthropicKey();

    const deriveName = (rawUrl: string) => {
      try {
        const { pathname } = new URL(rawUrl);
        const segment = pathname.split("/").filter(Boolean).pop();
        return segment ?? "";
      } catch {
        return "";
      }
    };

    const style: "factory" | "class" = opts.class ? "class" : "factory";
    let currentUrl = url;

    // Prompt for page name if not provided via flag
    let currentName = opts.name;
    if (!currentName) {
      const derived = deriveName(url);
      currentName = await input({
        message: "Page name:",
        ...(derived ? { default: derived } : {}),
        validate: (v) => v.trim().length > 0 || "Page name is required",
      });
    }

    // Prompt for output dir if not provided via flag
    let outputDir = opts.output;
    if (!outputDir) {
      outputDir = await input({
        message: "Output directory:",
        default: "poms",
      });
    }

    let hasCaptured = false;

    const isBlank = currentUrl === "about:blank";
    console.log(
      isBlank
        ? "\nOpening browser at about:blank — paste a URL in the address bar, then come back here."
        : `\nOpening browser at ${currentUrl} …`,
    );
    const { page, browser } = await createBrowserSession(currentUrl);
    if (!isBlank)
      console.log(
        "✓ Browser opened. Navigate to the page state you want to capture, then come back here.\n",
      );

    try {
      let running = true;
      while (running) {
        const action = await select({
          message: "What do you want to do?",
          choices: [
            {
              name: hasCaptured
                ? "Capture again (overwrite)"
                : "Capture ARIA snapshot & generate POM",
              value: "capture",
            },
            { name: "Navigate to a different URL", value: "navigate" },
            { name: "Exit", value: "exit" },
          ],
        });

        if (action === "exit") {
          running = false;
          break;
        }

        if (action === "capture") {
          console.log("  Capturing ARIA snapshot …");
          const snapshotYaml = await takeSnapshot(page);
          const snapshotPath = join(outputDir, `${currentName}.snapshot.yml`);
          await writeSnapshot(snapshotPath, snapshotYaml);
          console.log(`  ✓ Snapshot saved: ${snapshotPath}`);

          console.log("  Calling Claude …");
          const pomContent = await generatePom(snapshotYaml, currentName, style);
          const pomPath = join(outputDir, `${currentName}.page.ts`);
          await writePom(pomPath, pomContent);
          console.log(`  ✓ POM written:      ${pomPath}\n`);

          hasCaptured = true;
        }

        if (action === "navigate") {
          const newUrl = await input({
            message: "Enter URL:",
            validate: (v) => {
              try {
                new URL(v);
                return true;
              } catch {
                return "Please enter a valid URL (including https://)";
              }
            },
          });

          const newName = await input({
            message: "Page name:",
            default: deriveName(newUrl) || currentName,
          });

          console.log(`  Navigating to ${newUrl} …`);
          await page.goto(newUrl, { waitUntil: "domcontentloaded" });
          currentUrl = newUrl;
          currentName = newName;
          console.log("  ✓ Navigated. Interact with the page, then capture when ready.\n");
          hasCaptured = false;
        }
      }
    } catch (err: unknown) {
      // @inquirer/prompts throws ExitPromptError (extends Error) on Ctrl-C
      if (err instanceof Error && err.name === "ExitPromptError") {
        console.log("\nAborted.");
      } else {
        throw err;
      }
    } finally {
      await browser.close();
    }
  });

program.parse();
