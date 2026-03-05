# playwright-pom-mcp

An MCP server that generates functional [Page Object Models](https://playwright.dev/docs/pom) from live Playwright accessibility snapshots. Navigate your browser to any page state — including behind a login — and get a ready-to-use `.page.ts` file back.

## Installation

```sh
npm install -g @blastoiseomg/playwright-pom-mcp
npx playwright install chromium
```

> Chromium is required for browser capture. Run it once after installing.

## MCP server

### Claude Code

```sh
claude mcp add playwright-pom-mcp -- playwright-pom-mcp
```

Or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "playwright-pom-mcp": {
      "command": "playwright-pom-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright-pom-mcp": {
      "command": "playwright-pom-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### Without global install (npx)

```json
{
  "mcpServers": {
    "playwright-pom-mcp": {
      "command": "npx",
      "args": ["-y", "@blastoiseomg/playwright-pom-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `generate_pom` | Snapshot a page and generate a new POM TypeScript file |

## CLI

An interactive CLI is included alongside the MCP server. It opens a real (headed) browser, lets you navigate to any page state, and drives POM generation from your terminal.

```sh
pom-gen                                      # fully interactive
pom-gen https://example.com -n home -o poms  # with arguments
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

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Model to use for POM generation |

## How it works

**MCP tools:**

1. **`generate_pom`** — launches Chromium (headless by default, headed when `waitForUrl` is set), navigates to the URL, captures `page.locator('body').ariaSnapshot()`, sends the YAML to Claude with a system prompt enforcing functional POM conventions, and writes the result to disk.

**CLI (`pom-gen`):**

Runs a headed browser session you control. On startup, prompts for page name and output directory if not supplied as flags. The interactive menu lets you:
- **Capture** — take an ARIA snapshot of the current browser state and generate a new POM
- **Navigate** — send the browser to a new URL and optionally rename the current page

Generated POMs follow these conventions:
- Factory function pattern: `createCheckoutPage(page: Page)` (default)
- Class pattern: `CheckoutPage` with `readonly` locator properties (with `--class`)
- `locators` object with semantic locators (`getByRole`, `getByLabel`, etc.)
- All action methods are `async` and return `Promise<void>`

## Development

```sh
git clone https://github.com/vincenzo-gasparo/playwright-pom-mcp.git
cd playwright-pom-mcp
pnpm install
npx playwright install chromium
export ANTHROPIC_API_KEY="sk-ant-..."
pnpm build
```

| Command | Description |
|---|---|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm dev` | Run MCP server with `tsx` (no build needed) |
| `pnpm dev:cli` | Run interactive CLI with `tsx` (no build needed) |
| `pnpm test` | Run unit tests |

### Testing with MCP Inspector

```sh
npx @modelcontextprotocol/inspector node dist/index.js
```

Open `http://localhost:5173`, select `generate_pom`, and try:

```json
{
  "url": "https://playwright.dev",
  "name": "home",
  "outputDir": "./out"
}
```
