import { type Browser, chromium, devices, type Page } from "playwright";

export interface BrowserSessionOptions {
  url: string;
  headed: boolean;
  waitForUrl?: string;
  timeout?: number;
}

/**
 * Launch a browser, navigate to the URL, optionally wait for a URL pattern,
 * capture an ARIA accessibility snapshot, then always close the browser.
 */
export async function runBrowserSession(
  opts: BrowserSessionOptions,
): Promise<{ snapshotYaml: string }> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: !opts.headed,
      // Disable HTTP/2 to avoid ERR_HTTP2_PROTOCOL_ERROR on sites with strict H2 negotiation
      args: ["--disable-http2"],
    });
    const context = await browser.newContext({ ...devices["Desktop Chrome"] });
    const page = await context.newPage();
    // 'commit' resolves as soon as the response starts streaming — avoids timing out
    // on SPAs or pages that gate DOMContentLoaded behind anti-bot JS
    await page.goto(opts.url, { waitUntil: "domcontentloaded" });

    if (opts.waitForUrl) {
      await page.waitForURL(opts.waitForUrl, { timeout: opts.timeout ?? 120_000 });
    }

    const snapshotYaml = await page.locator("body").ariaSnapshot();
    return { snapshotYaml };
  } finally {
    await browser?.close();
  }
}

export interface BrowserSession {
  page: Page;
  browser: Browser;
}

/**
 * Launch a persistent headed browser and navigate to url.
 * Caller owns lifecycle — must call browser.close() in a finally block.
 */
export async function createBrowserSession(url: string): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: false, args: ["--disable-http2"] });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { page, browser };
}

/** Capture ARIA accessibility snapshot from a live page. */
export async function takeSnapshot(page: Page): Promise<string> {
  return page.locator("body").ariaSnapshot();
}
