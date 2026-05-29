import { findEtfProfile, normalizeTwSymbol, toYahooSymbol } from "./data.mjs";
import { loadQuoteCache, saveQuoteCache } from "./storage.mjs";

export const QUOTE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export function getFallbackQuote(symbol, manualPrice) {
  const normalized = normalizeTwSymbol(symbol);
  const profile = findEtfProfile(normalized);
  const price = Number(manualPrice) > 0 ? Number(manualPrice) : profile?.demoPrice;
  return {
    symbol: normalized,
    yahooSymbol: toYahooSymbol(normalized),
    price: price || 0,
    currency: "TWD",
    source: price ? "fallback" : "unavailable",
    status: price ? "報價暫不可用" : "查無價格",
    fetchedAt: null,
    expiresAt: null,
  };
}

export function getCachedQuote(symbol, now = Date.now()) {
  const normalized = normalizeTwSymbol(symbol);
  const cache = loadQuoteCache();
  const quote = cache[normalized];
  if (!quote) return null;
  if (quote.expiresAt && quote.expiresAt > now) {
    return { ...quote, source: "cache", status: "使用快取" };
  }
  return null;
}

export async function yahooQuoteProvider(holdings) {
  const now = Date.now();
  const cache = loadQuoteCache();
  const uniqueSymbols = [...new Set(holdings.map((holding) => normalizeTwSymbol(holding.symbol)).filter(Boolean))];
  const result = {};
  const missing = [];

  for (const symbol of uniqueSymbols) {
    const cached = cache[symbol];
    if (cached?.expiresAt && cached.expiresAt > now) {
      result[symbol] = { ...cached, source: "cache", status: "使用快取" };
    } else {
      missing.push(symbol);
    }
  }

  if (missing.length > 0) {
    try {
      const yahooSymbols = missing.map(toYahooSymbol);
      const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(yahooSymbols.join(","))}`);
      if (!response.ok) throw new Error(`Quote request failed: ${response.status}`);
      const data = await response.json();
      const quotes = data?.quoteResponse?.result || [];

      for (const quote of quotes) {
        const symbol = normalizeTwSymbol(quote.symbol);
        const price = Number(quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice);
        if (!symbol || !Number.isFinite(price) || price <= 0) continue;
        const normalizedQuote = {
          symbol,
          yahooSymbol: quote.symbol,
          price,
          currency: quote.currency || "TWD",
          source: "yahoo",
          status: "成功",
          fetchedAt: now,
          expiresAt: now + QUOTE_CACHE_TTL_MS,
        };
        cache[symbol] = normalizedQuote;
        result[symbol] = normalizedQuote;
      }
      saveQuoteCache(cache);
    } catch (error) {
      console.warn(error);
    }
  }

  for (const holding of holdings) {
    const symbol = normalizeTwSymbol(holding.symbol);
    if (!symbol || result[symbol]) continue;
    const stale = cache[symbol];
    if (stale) {
      result[symbol] = { ...stale, source: "stale-cache", status: "使用過期快取" };
    } else {
      result[symbol] = getFallbackQuote(symbol, holding.manualPrice);
    }
  }

  return result;
}
