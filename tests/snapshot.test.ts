import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writePom, writeSnapshot } from "../src/snapshot.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `pom-gen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("writeSnapshot", () => {
  it("writes YAML content to disk", async () => {
    const filePath = join(testDir, "home.snapshot.yml");
    const yaml = "- role: main\n  name: Home\n";

    await writeSnapshot(filePath, yaml);

    expect(await readFile(filePath, "utf-8")).toBe(yaml);
  });

  it("creates parent directories if they do not exist", async () => {
    const filePath = join(testDir, "nested", "deep", "login.snapshot.yml");

    await writeSnapshot(filePath, "content");

    expect(await readFile(filePath, "utf-8")).toBe("content");
  });

  it("overwrites existing content", async () => {
    const filePath = join(testDir, "page.snapshot.yml");

    await writeSnapshot(filePath, "original");
    await writeSnapshot(filePath, "updated");

    expect(await readFile(filePath, "utf-8")).toBe("updated");
  });
});

describe("writePom", () => {
  it("writes TypeScript content to disk", async () => {
    const filePath = join(testDir, "home.page.ts");
    const ts = "export function createHomePage(page: Page) { return {}; }\n";

    await writePom(filePath, ts);

    expect(await readFile(filePath, "utf-8")).toBe(ts);
  });

  it("creates parent directories if they do not exist", async () => {
    const filePath = join(testDir, "poms", "auth", "login.page.ts");

    await writePom(filePath, "export class LoginPage {}");

    expect(await readFile(filePath, "utf-8")).toBe("export class LoginPage {}");
  });

  it("overwrites existing content", async () => {
    const filePath = join(testDir, "page.ts");

    await writePom(filePath, "original content");
    await writePom(filePath, "updated content");

    expect(await readFile(filePath, "utf-8")).toBe("updated content");
  });

  it("preserves multiline content exactly", async () => {
    const filePath = join(testDir, "multiline.page.ts");
    const ts = [
      "import { type Page } from '@playwright/test';",
      "",
      "export function createCheckoutPage(page: Page) {",
      "  return {",
      "    locators: {",
      "      submitButton: page.getByRole('button', { name: 'Submit' }),",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n");

    await writePom(filePath, ts);

    expect(await readFile(filePath, "utf-8")).toBe(ts);
  });
});
