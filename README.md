# playwright-pom-mcp

An MCP server that generates functional [Page Object Models](https://playwright.dev/docs/pom) from live Playwright accessibility snapshots. Navigate your browser to any page state — including behind a login — and get a ready-to-use `.page.ts` file back.

## Tools

| Tool | Description |
|---|---|
| `generate_pom` | Snapshot a page and generate a new POM TypeScript file |

## CLI

An interactive CLI is included alongside the MCP server. It opens a real (headed) browser, lets you navigate to any page state, and drives POM generation from your terminal.

```sh
pnpm dev:cli                    # fully interactive — prompts for page name and output dir
pnpm dev:cli https://example.com -n home -o poms
```

**Options**

| Flag | Description | Default |
|---|---|---|
| `[url]` | URL to open (paste in browser if omitted) | `about:blank` |
| `-n, --name <name>` | Page name | prompted |
| `-o, --output <dir>` | Output directory | prompted (default `poms`) |
| `--class` | Generate a class-based POM instead of factory function style | — |

**Interactive menu actions**

| Action | Description |
|---|---|
| Capture ARIA snapshot & generate POM | Snapshots the current page and generates (or overwrites) the `.page.ts` file |
| Navigate to a different URL | Navigates the browser to a new URL and updates the page name |
| Exit | Closes the browser and exits |

## Requirements

- Node.js 20+
- pnpm
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

## Setup

```sh
git clone <repo-url>
cd playwright-pom-mcp

pnpm install
npx playwright install chromium

export ANTHROPIC_API_KEY="sk-ant-..."

pnpm build
```

## Testing locally before publishing

### Option 1 — MCP Inspector (recommended)

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) gives you a browser UI to call tools interactively and inspect inputs/outputs.

The server automatically loads `.env` from the project root at startup, so no manual sourcing is needed:

```sh
npx @modelcontextprotocol/inspector node dist/index.js
```

Open the URL printed in the terminal (usually `http://localhost:5173`). You will see both tools listed. Try this call to verify end-to-end:

**Tool:** `generate_pom`
```json
{
  "url": "https://playwright.dev",
  "name": "home",
  "outputDir": "./out"
}
```

After a few seconds you should see `out/home.page.ts` and `out/home.snapshot.yml` created in the project root.

To test the headed flow (e.g. a page behind a login):

```json
{
  "url": "https://example.com/login",
  "name": "dashboard",
  "outputDir": "./out",
  "waitForUrl": "**/dashboard**"
}
```

A Chromium window opens. Log in manually. Once the URL matches the glob, the snapshot is captured and the POM is generated.

### Option 2 — dev mode with `tsx`

Useful for iterating on the source without a build step. The server speaks MCP over stdio, so pipe requests directly:

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | pnpm dev
```

You should get back a JSON response listing `generate_pom`.

### Option 3 — Claude Code (local registration)

Register the built server in your Claude Code settings to call the tools directly from chat.

Add the following to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "playwright-pom-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/playwright-pom-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Then restart Claude Code and ask it to call `generate_pom`.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Model to use for POM generation |

### MCP server

Pass variables via the `env` field in your MCP client config:

```json
{
  "mcpServers": {
    "playwright-pom-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/playwright-pom-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "ANTHROPIC_MODEL": "claude-opus-4-6"
      }
    }
  }
}
```

### CLI (`pom-gen`)

Export variables in your shell profile:

```sh
# ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-..."
export ANTHROPIC_MODEL="claude-opus-4-6"  # optional
```

Or inline for a single run:

```sh
ANTHROPIC_API_KEY=sk-ant-... pom-gen
```

## Project structure

```
src/
├── index.ts          # MCP server entry point, tool registration
├── cli.ts            # Interactive CLI entry point
├── browser.ts        # Playwright browser lifecycle and ariaSnapshot()
├── generator.ts      # Claude API prompt for POM generation
├── snapshot.ts       # File I/O helpers for .yml and .ts files
└── tools/
    └── generate.ts   # generate_pom tool (Zod schema + handler)
```

## Scripts

| Command | Description |
|---|---|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm dev` | Run MCP server with `tsx` (no build needed) |
| `pnpm dev:cli` | Run interactive CLI with `tsx` (no build needed) |
| `pnpm start` | Run compiled MCP server (`dist/index.js`) |
| `pnpm start:cli` | Run compiled CLI (`dist/cli.js`) |

## How it works

**MCP tools:**

1. **`generate_pom`** — launches Chromium (headless by default, headed when `waitForUrl` is set), navigates to the URL, captures `page.locator('body').ariaSnapshot()`, sends the YAML to Claude with a system prompt enforcing functional POM conventions, and writes the result to disk.

**CLI (`pom-gen`):**

Runs a headed browser session you control. On startup, prompts for page name and output directory if not supplied as flags. The interactive menu lets you:
- **Capture** — take an ARIA snapshot of the current browser state and generate a new POM
- **Update** — re-snapshot the current page and get a Claude-generated diff against an existing POM (snapshot updated, POM unchanged)
- **Navigate** — send the browser to a new URL and optionally rename the current page

Generated POMs follow these conventions:
- Factory function pattern: `createCheckoutPage(page: Page)` (default)
- Class pattern: `CheckoutPage` with `readonly` locator properties (with `--class`)
- `locators` object with semantic locators (`getByRole`, `getByLabel`, etc.)
- All action methods are `async` and return `Promise<void>`
