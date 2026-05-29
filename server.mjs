import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function proxyQuotes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const symbols = url.searchParams.get("symbols");
  if (!symbols) {
    sendJson(res, 400, { error: "Missing symbols parameter." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const yahooSymbols = symbols
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  try {
    const result = await Promise.all(yahooSymbols.map((symbol) => fetchYahooChartQuote(symbol, controller.signal)));
    sendJson(res, 200, {
      quoteResponse: {
        result: result.filter(Boolean),
        error: null,
      },
    });
  } catch (error) {
    sendJson(res, 502, {
      error: error.name === "AbortError" ? "Yahoo quote request timed out." : "Yahoo quote request failed.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooChartQuote(symbol, signal) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const response = await fetch(yahooUrl, {
    signal,
    headers: {
      "user-agent": "Mozilla/5.0 ETF retirement calculator prototype",
      accept: "application/json",
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const chart = data?.chart?.result?.[0];
  const meta = chart?.meta;
  const close = chart?.indicators?.quote?.[0]?.close?.find((value) => Number.isFinite(value));
  const price = Number(meta?.regularMarketPrice || close);
  if (!meta?.symbol || !Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: meta.symbol,
    regularMarketPrice: price,
    currency: meta.currency || "TWD",
    regularMarketTime: meta.regularMarketTime,
    shortName: meta.shortName,
    longName: meta.longName,
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/quotes")) {
    proxyQuotes(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`ETF retirement calculator running at http://localhost:${port}`);
});
