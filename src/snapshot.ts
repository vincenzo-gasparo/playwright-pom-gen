import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Write YAML snapshot content to disk, creating parent directories if needed.
 */
export async function writeSnapshot(filePath: string, yaml: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, yaml, "utf-8");
}

/**
 * Write a TypeScript POM file to disk, creating parent directories if needed.
 */
export async function writePom(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
