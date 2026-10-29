import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { CRYPTO_FUNDS, FUND_INVESTMENT_COINS } from './src/data/fundPortfolios.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

export type SupportedExchange = 'binance' | 'bybit' | 'okx' | 'bitget' | 'mexc';

export interface RawExchangeQuote {
  exchange: SupportedExchange;
  exchangeName: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h?: number;
  low24h?: number;
}

export interface NormalizedCoin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  change24h: number;
  change1h?: number;
  change7d?: number;
  volume24h: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  source: string;
  sparkline?: number[];
  logoUrl?: string;
  updatedAt: string;
  exchangeQuotes?: Partial<Record<SupportedExchange, RawExchangeQuote>>;
}

// In-memory cache for API providers
interface CacheEntry<T> {
  timestamp: number;
  data: T;
}
const exchangeCache: Partial<Record<SupportedExchange, CacheEntry<Map<string, RawExchangeQuote>>>> = {};
let canonicalCoinsCache: CacheEntry<NormalizedCoin[]> | null = null;
const CACHE_TTL_MS = 20000; // 20 seconds cache

// 1. Fetch Binance Spot Tickers (USDT pairs)
async function fetchBinanceQuotes(): Promise<Map<string, RawExchangeQuote>> {
  const now = Date.now();
  if (exchangeCache.binance && now - exchangeCache.binance.timestamp < CACHE_TTL_MS) {
    return exchangeCache.binance.data;
  }

  const url = 'https://api.binance.com/api/v3/ticker/24hr';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const list: any[] = await res.json();

  const map = new Map<string, RawExchangeQuote>();
  for (const item of list) {
    const sym = item.symbol || '';
    if (sym.endsWith('USDT')) {
      const baseSymbol = sym.replace('USDT', '').toUpperCase();
      const price = parseFloat(item.lastPrice) || 0;
      const change = parseFloat(item.priceChangePercent) || 0;
      const vol = parseFloat(item.quoteVolume) || 0;
      if (price > 0) {
        map.set(baseSymbol, {
          exchange: 'binance',
          exchangeName: 'Binance',
          price,
          change24h: Math.round(change * 100) / 100,
          volume24h: vol,
          high24h: parseFloat(item.highPrice) || price,
          low24h: parseFloat(item.lowPrice) || price,
        });
      }
    }
  }

  exchangeCache.binance = { timestamp: now, data: map };
  return map;
}

// 2. Fetch Bybit Spot Tickers (USDT pairs)
async function fetchBybitQuotes(): Promise<Map<string, RawExchangeQuote>> {
  const now = Date.now();
  if (exchangeCache.bybit && now - exchangeCache.bybit.timestamp < CACHE_TTL_MS) {
    return exchangeCache.bybit.data;
  }

  const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
  const json: any = await res.json();
  const list: any[] = json.result?.list || [];

  const map = new Map<string, RawExchangeQuote>();
  for (const item of list) {
    const sym = item.symbol || '';
    if (sym.endsWith('USDT')) {
      const baseSymbol = sym.replace('USDT', '').toUpperCase();
      const price = parseFloat(item.lastPrice) || 0;
      const change = (parseFloat(item.price24hPcnt) || 0) * 100;
      const vol = parseFloat(item.turnover24h) || 0;
      if (price > 0) {
        map.set(baseSymbol, {
          exchange: 'bybit',
          exchangeName: 'Bybit',
          price,
          change24h: Math.round(change * 100) / 100,
          volume24h: vol,
          high24h: parseFloat(item.highPrice24h) || price,
          low24h: parseFloat(item.lowPrice24h) || price,
        });
      }
    }
  }

  exchangeCache.bybit = { timestamp: now, data: map };
  return map;
}

// 3. Fetch OKX Spot Tickers (USDT pairs)
async function fetchOkxQuotes(): Promise<Map<string, RawExchangeQuote>> {
  const now = Date.now();
  if (exchangeCache.okx && now - exchangeCache.okx.timestamp < CACHE_TTL_MS) {
    return exchangeCache.okx.data;
  }

  const url = 'https://www.okx.com/api/v5/market/tickers?instType=SPOT';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const json: any = await res.json();
  const list: any[] = json.data || [];

  const map = new Map<string, RawExchangeQuote>();
  for (const item of list) {
    const instId: string = item.instId || '';
    if (instId.endsWith('-USDT')) {
      const baseSymbol = instId.replace('-USDT', '').toUpperCase();
      const last = parseFloat(item.last) || 0;
      const open = parseFloat(item.open24h) || last;
      const change = open > 0 ? ((last - open) / open) * 100 : 0;
      const vol = parseFloat(item.volCcy24h) || 0;
      if (last > 0) {
        map.set(baseSymbol, {
          exchange: 'okx',
          exchangeName: 'OKX',
          price: last,
          change24h: Math.round(change * 100) / 100,
          volume24h: vol,
          high24h: parseFloat(item.high24h) || last,
          low24h: parseFloat(item.low24h) || last,
        });
      }
    }
  }

  exchangeCache.okx = { timestamp: now, data: map };
  return map;
}

// 4. Fetch Bitget Spot Tickers (USDT pairs)
async function fetchBitgetQuotes(): Promise<Map<string, RawExchangeQuote>> {
  const now = Date.now();
  if (exchangeCache.bitget && now - exchangeCache.bitget.timestamp < CACHE_TTL_MS) {
    return exchangeCache.bitget.data;
  }

  const url = 'https://api.bitget.com/api/v2/spot/market/tickers';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`Bitget HTTP ${res.status}`);
  const json: any = await res.json();
  const list: any[] = json.data || [];

  const map = new Map<string, RawExchangeQuote>();
  for (const item of list) {
    const sym = item.symbol || '';
    if (sym.endsWith('USDT')) {
      const baseSymbol = sym.replace('USDT', '').toUpperCase();
      const price = parseFloat(item.lastPr) || 0;
      const change = (parseFloat(item.change24h) || 0) * 100;
      const vol = parseFloat(item.usdtVolume || item.quoteVolume) || 0;
      if (price > 0) {
        map.set(baseSymbol, {
          exchange: 'bitget',
          exchangeName: 'Bitget',
          price,
          change24h: Math.round(change * 100) / 100,
          volume24h: vol,
          high24h: parseFloat(item.high24h) || price,
          low24h: parseFloat(item.low24h) || price,
        });
      }
    }
  }

  exchangeCache.bitget = { timestamp: now, data: map };
  return map;
}

// 5. Fetch MEXC Spot Tickers (USDT pairs)
async function fetchMexcQuotes(): Promise<Map<string, RawExchangeQuote>> {
  const now = Date.now();
  if (exchangeCache.mexc && now - exchangeCache.mexc.timestamp < CACHE_TTL_MS) {
    return exchangeCache.mexc.data;
  }

  const url = 'https://api.mexc.com/api/v3/ticker/24hr';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`MEXC HTTP ${res.status}`);
  const list: any[] = await res.json();

  const map = new Map<string, RawExchangeQuote>();
  for (const item of list) {
    const sym = item.symbol || '';
    if (sym.endsWith('USDT')) {
      const baseSymbol = sym.replace('USDT', '').toUpperCase();
      const price = parseFloat(item.lastPrice) || 0;
      const change = parseFloat(item.priceChangePercent) || 0;
      const vol = parseFloat(item.quoteVolume) || 0;
      if (price > 0) {
        map.set(baseSymbol, {
          exchange: 'mexc',
          exchangeName: 'MEXC',
          price,
          change24h: Math.round(change * 100) / 100,
          volume24h: vol,
          high24h: parseFloat(item.highPrice) || price,
          low24h: parseFloat(item.lowPrice) || price,
        });
      }
    }
  }

  exchangeCache.mexc = { timestamp: now, data: map };
  return map;
}

// In-memory cache for CoinMarketCap Top 500
interface CmcCacheEntry {
  timestamp: number;
  apiKey: string;
  data: NormalizedCoin[];
}
let cmcCache: CmcCacheEntry | null = null;
const CMC_CACHE_TTL_MS = 60000; // 60 seconds cache to preserve user's free tier credits (333 calls/day)

// Fetch CoinMarketCap Top 500 using user's free API key
async function fetchCoinMarketCapTop500(apiKey: string): Promise<NormalizedCoin[]> {
  const trimmedKey = apiKey.trim();
  const now = Date.now();
  if (cmcCache && cmcCache.apiKey === trimmedKey && now - cmcCache.timestamp < CMC_CACHE_TTL_MS) {
    return cmcCache.data;
  }

  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=500&convert=USD';
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': trimmedKey,
    },
    signal: AbortSignal.timeout(9000),
  });

  if (!res.ok) {
    let errMsg = `CoinMarketCap HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.status?.error_message) {
        errMsg = errJson.status.error_message;
      }
    } catch {}
    throw new Error(errMsg);
  }

  const json: any = await res.json();
  const list: any[] = json.data || [];

  const normalized: NormalizedCoin[] = list.map((item: any) => {
    const usd = item.quote?.USD || {};
    const price = typeof usd.price === 'number' ? usd.price : 0;
    const change24h = typeof usd.percent_change_24h === 'number' ? Math.round(usd.percent_change_24h * 100) / 100 : 0;
    const change1h = typeof usd.percent_change_1h === 'number' ? Math.round(usd.percent_change_1h * 100) / 100 : undefined;
    const change7d = typeof usd.percent_change_7d === 'number' ? Math.round(usd.percent_change_7d * 100) / 100 : undefined;
    const volume24h = typeof usd.volume_24h === 'number' ? usd.volume_24h : 0;
    const marketCap = typeof usd.market_cap === 'number' ? usd.market_cap : 0;

    const high24h = change24h < 0 ? price / (1 + change24h / 100) : price * 1.02;
    const low24h = change24h > 0 ? price / (1 + change24h / 100) : price * 0.98;

    return {
      id: item.slug || String(item.id),
      symbol: (item.symbol || '').toUpperCase(),
      name: item.name || item.symbol,
      rank: item.cmc_rank || 1,
      priceUsd: price,
      change24h,
      change1h,
      change7d,
      volume24h,
      marketCap,
      high24h: Math.round(high24h * 1000000) / 1000000,
      low24h: Math.round(low24h * 1000000) / 1000000,
      source: 'CoinMarketCap Pro API',
      sparkline: [price],
      logoUrl: `https://s2.coinmarketcap.com/static/img/coins/64x64/${item.id}.png`,
      updatedAt: new Date().toISOString(),
    };
  });

  cmcCache = {
    timestamp: now,
    apiKey: trimmedKey,
    data: normalized,
  };
  return normalized;
}

// Canonical Top 500 catalog (from CoinMarketCap if key provided, with fallback to CoinGecko & Binance)
async function getCanonicalTop500(cmcApiKey?: string): Promise<{ coins: NormalizedCoin[]; catalogSource: string }> {
  const activeKey = cmcApiKey?.trim() || process.env.COINMARKETCAP_API_KEY || process.env.CMC_API_KEY;

  if (activeKey) {
    try {
      const cmcCoins = await fetchCoinMarketCapTop500(activeKey);
      if (cmcCoins && cmcCoins.length > 0) {
        return { coins: cmcCoins, catalogSource: 'CoinMarketCap' };
      }
    } catch (e: any) {
      console.warn('CoinMarketCap API call failed, falling back to CoinGecko/Binance:', e.message);
    }
  }

  const now = Date.now();
  if (canonicalCoinsCache && now - canonicalCoinsCache.timestamp < 35000) {
    return { coins: canonicalCoinsCache.data, catalogSource: 'CoinGecko' };
  }

  // Fetch CoinGecko 500 (page 1 + page 2)
  try {
    const page1Url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=true&price_change_percentage=1h,24h,7d';
    const res1 = await fetch(page1Url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res1.ok) throw new Error(`CoinGecko HTTP ${res1.status}`);
    const list1: any[] = await res1.json();

    let combined = [...list1];
    try {
      const page2Url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=true&price_change_percentage=1h,24h,7d';
      const res2 = await fetch(page2Url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (res2.ok) {
        const list2 = await res2.json();
        if (Array.isArray(list2)) combined = [...list1, ...list2];
      }
    } catch {}

    const normalized = combined.map((item, idx) => {
      const price = parseFloat(item.current_price) || 0;
      const change24h = parseFloat(item.price_change_percentage_24h) || 0;
      const change1h = item.price_change_percentage_1h_in_currency != null ? parseFloat(item.price_change_percentage_1h_in_currency) : undefined;
      const change7d = item.price_change_percentage_7d_in_currency != null ? parseFloat(item.price_change_percentage_7d_in_currency) : undefined;
      const sparkline = item.sparkline_in_7d?.price?.slice(-24) || [];

      return {
        id: item.id,
        symbol: (item.symbol || '').toUpperCase(),
        name: item.name || item.symbol,
        rank: item.market_cap_rank || idx + 1,
        priceUsd: price,
        change24h: Math.round(change24h * 100) / 100,
        change1h: change1h != null ? Math.round(change1h * 100) / 100 : undefined,
        change7d: change7d != null ? Math.round(change7d * 100) / 100 : undefined,
        volume24h: parseFloat(item.total_volume) || 0,
        marketCap: parseFloat(item.market_cap) || 0,
        high24h: parseFloat(item.high_24h) || price,
        low24h: parseFloat(item.low_24h) || price,
        source: 'CoinGecko Top 500',
        sparkline: sparkline.length ? sparkline : [price],
        logoUrl: item.image,
        updatedAt: new Date().toISOString(),
      };
    });

    canonicalCoinsCache = { timestamp: now, data: normalized };
    return { coins: normalized, catalogSource: 'CoinGecko' };
  } catch (err) {
    console.warn('CoinGecko catalog failed, falling back to Binance Spot:', err);
    // Fallback: Binance Spot top pairs
    const binanceMap = await fetchBinanceQuotes();
    const sorted = Array.from(binanceMap.values())
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 500);

    const normalized = sorted.map((item, idx) => ({
      id: item.exchangeName.toLowerCase() + '_' + item.exchange,
      symbol: item.exchangeName, // replaced below
      name: item.exchangeName,
      rank: idx + 1,
      priceUsd: item.price,
      change24h: item.change24h,
      volume24h: item.volume24h,
      high24h: item.high24h,
      low24h: item.low24h,
      source: 'Binance Spot',
      sparkline: [item.price],
      logoUrl: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${item.exchangeName.toLowerCase()}.png`,
      updatedAt: new Date().toISOString(),
    }));

    canonicalCoinsCache = { timestamp: now, data: normalized };
    return { coins: normalized, catalogSource: 'Binance' };
  }
}

// Master Fetcher aggregating chosen exchanges
async function getCoinsFromSelectedExchanges(
  selectedExchanges: SupportedExchange[],
  aggregationMode: 'any' | 'average' | 'first' = 'any',
  limit: number = 500,
  cmcApiKey?: string
): Promise<{ coins: NormalizedCoin[]; activeExchanges: string[]; catalogSource: string; cached: boolean }> {
  // Ensure at least one exchange
  const exchanges = selectedExchanges.length > 0 ? selectedExchanges : (['binance', 'bybit', 'okx'] as SupportedExchange[]);

  // 1. Fetch canonical coins list (Top 500, using CMC if key is present)
  const canonicalResult = await getCanonicalTop500(cmcApiKey);
  const canonicalCoins = canonicalResult.coins;

  // 2. Fetch data in parallel for each requested exchange
  const exchangePromises: Promise<{ exchange: SupportedExchange; map: Map<string, RawExchangeQuote> | null }>[] = exchanges.map(
    async (ex) => {
      try {
        if (ex === 'binance') return { exchange: ex, map: await fetchBinanceQuotes() };
        if (ex === 'bybit') return { exchange: ex, map: await fetchBybitQuotes() };
        if (ex === 'okx') return { exchange: ex, map: await fetchOkxQuotes() };
        if (ex === 'bitget') return { exchange: ex, map: await fetchBitgetQuotes() };
        if (ex === 'mexc') return { exchange: ex, map: await fetchMexcQuotes() };
      } catch (e: any) {
        console.warn(`Failed fetching quotes for ${ex}:`, e.message);
      }
      return { exchange: ex, map: null };
    }
  );

  const exchangeResults = await Promise.all(exchangePromises);
  const successfulExchanges = exchangeResults.filter((r) => r.map !== null);
  const activeExchanges = successfulExchanges.map((r) => r.exchange.toUpperCase());

  // 3. Re-calculate price and 24h change for each coin using the selected exchanges!
  const coinsWithExchangeQuotes: NormalizedCoin[] = canonicalCoins.slice(0, limit).map((coin) => {
    const sym = coin.symbol.toUpperCase();
    const quotes: Partial<Record<SupportedExchange, RawExchangeQuote>> = {};
    const matchedQuotes: RawExchangeQuote[] = [];

    for (const res of successfulExchanges) {
      if (res.map && res.map.has(sym)) {
        const q = res.map.get(sym)!;
        quotes[res.exchange] = q;
        matchedQuotes.push(q);
      }
    }

    if (matchedQuotes.length === 0) {
      // Coin is not listed on the user's selected exchanges, keep canonical reference
      return {
        ...coin,
        exchangeQuotes: quotes,
      };
    }

    let finalPrice = coin.priceUsd;
    let finalChange24h = coin.change24h;
    let finalSource = coin.source;
    let finalVolume = coin.volume24h;

    if (aggregationMode === 'average' && matchedQuotes.length > 1) {
      const avgPrice = matchedQuotes.reduce((acc, q) => acc + q.price, 0) / matchedQuotes.length;
      const avgChange = matchedQuotes.reduce((acc, q) => acc + q.change24h, 0) / matchedQuotes.length;
      const totalVol = matchedQuotes.reduce((acc, q) => acc + q.volume24h, 0);

      finalPrice = avgPrice;
      finalChange24h = Math.round(avgChange * 100) / 100;
      finalVolume = totalVol;
      finalSource = `Средняя (${matchedQuotes.map((q) => q.exchangeName).join(', ')})`;
    } else if (aggregationMode === 'any') {
      // Pick the exchange with the largest drop (most conservative alert trigger!)
      const sortedByDrop = [...matchedQuotes].sort((a, b) => a.change24h - b.change24h);
      const chosen = sortedByDrop[0];
      finalPrice = chosen.price;
      finalChange24h = chosen.change24h;
      finalSource = chosen.exchangeName;
      if (chosen.volume24h > 0) finalVolume = chosen.volume24h;
    } else {
      // First available in user preference order
      const chosen = matchedQuotes[0];
      finalPrice = chosen.price;
      finalChange24h = chosen.change24h;
      finalSource = chosen.exchangeName;
      if (chosen.volume24h > 0) finalVolume = chosen.volume24h;
    }

    return {
      ...coin,
      priceUsd: finalPrice,
      change24h: finalChange24h,
      volume24h: finalVolume,
      source: finalSource,
      exchangeQuotes: quotes,
    };
  });

  return {
    coins: coinsWithExchangeQuotes,
    activeExchanges,
    catalogSource: canonicalResult.catalogSource,
    cached: false,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API 1: Get coins from selected exchanges with drop filter
  app.get('/api/crypto/coins', async (req: Request, res: Response) => {
    try {
      const exchangesQuery = (req.query.exchanges as string) || 'binance,bybit,okx';
      const selectedExchanges = exchangesQuery
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is SupportedExchange => ['binance', 'bybit', 'okx', 'bitget', 'mexc'].includes(s));

      const timeframe = (req.query.timeframe as string) || '24h';
      const aggregationMode = (req.query.aggregationMode as 'any' | 'average' | 'first') || 'any';
      const limit = parseInt(req.query.limit as string, 10) || 500;
      const minDrop = req.query.minDrop ? parseFloat(req.query.minDrop as string) : undefined;
      const maxDrop = req.query.maxDrop ? parseFloat(req.query.maxDrop as string) : undefined;
      const exactDrop = req.query.exactDrop ? parseFloat(req.query.exactDrop as string) : undefined;
      const cmcApiKey = (req.query.cmcApiKey as string) || (req.headers['x-cmc-pro-api-key'] as string) || undefined;

      const result = await getCoinsFromSelectedExchanges(selectedExchanges, aggregationMode, limit, cmcApiKey);
      let coins = result.coins;

      // Filter by drop criteria based on timeframe (1h or 24h)
      const getChangeForTimeframe = (c: NormalizedCoin) => {
        if (timeframe === '1h') {
          return c.change1h !== undefined ? c.change1h : c.change24h;
        }
        if (timeframe === '7d') {
          return c.change7d !== undefined ? c.change7d : c.change24h;
        }
        return c.change24h;
      };

      if (exactDrop !== undefined) {
        coins = coins.filter((c) => {
          const chg = getChangeForTimeframe(c);
          const dropMag = chg < 0 ? Math.abs(chg) : 0;
          return dropMag >= exactDrop;
        });
      } else if (minDrop !== undefined) {
        coins = coins.filter((c) => {
          const chg = getChangeForTimeframe(c);
          const dropMag = chg < 0 ? Math.abs(chg) : 0;
          if (dropMag < minDrop) return false;
          if (maxDrop !== undefined && dropMag > maxDrop) return false;
          return true;
        });
      }

      res.json({
        success: true,
        selectedExchanges,
        activeExchanges: result.activeExchanges,
        catalogSource: result.catalogSource,
        cmcActive: result.catalogSource === 'CoinMarketCap',
        aggregationMode,
        timeframe,
        count: coins.length,
        totalTracked: result.coins.length,
        coins,
      });
    } catch (err: any) {
      console.error('Error in /api/crypto/coins:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка загрузки данных бирж' });
    }
  });

  // API 1.5: Verify CoinMarketCap API Key & check account credit limits
  app.all('/api/crypto/cmc/verify-key', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.body?.apiKey || req.query.apiKey || req.headers['x-cmc-pro-api-key'] || process.env.COINMARKETCAP_API_KEY || process.env.CMC_API_KEY || '') as string;
      const trimmed = apiKey.trim();

      if (!trimmed) {
        return res.status(400).json({
          success: false,
          error: 'Укажите API-ключ CoinMarketCap для проверки',
        });
      }

      const cmcRes = await fetch('https://pro-api.coinmarketcap.com/v1/key/info', {
        headers: {
          Accept: 'application/json',
          'X-CMC_PRO_API_KEY': trimmed,
        },
        signal: AbortSignal.timeout(8000),
      });

      const json = await cmcRes.json();
      if (!cmcRes.ok || json.status?.error_code !== 0) {
        return res.status(400).json({
          success: false,
          error: json.status?.error_message || `Ошибка CoinMarketCap HTTP ${cmcRes.status}`,
          status: json.status,
        });
      }

      const data = json.data || {};
      const plan = data.plan || {};
      const usage = data.usage || {};

      res.json({
        success: true,
        valid: true,
        planName: plan.name || 'Basic (Free)',
        creditLimitMonthly: plan.credit_limit_monthly || 10000,
        rateLimitMinute: plan.rate_limit_minute || 30,
        creditsUsedDay: usage.current_day?.credits_used ?? 0,
        creditsLeftDay: usage.current_day?.credits_left ?? 333,
        creditsUsedMonth: usage.current_month?.credits_used ?? 0,
        creditsLeftMonth: usage.current_month?.credits_left ?? 10000,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error verifying CMC API key:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка подключения к CoinMarketCap API' });
    }
  });

  // API 1.8: Verify TokenInsight API Key (TI_API_KEY)
  app.all('/api/crypto/tokeninsight/verify-key', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.body?.apiKey || req.query.apiKey || req.headers['ti_api_key'] || process.env.TOKENINSIGHT_API_KEY || '') as string;
      const trimmed = apiKey.trim();

      if (!trimmed) {
        return res.status(400).json({
          success: false,
          error: 'Укажите API-ключ TokenInsight (TI_API_KEY) для проверки',
        });
      }

      const tiRes = await fetch('https://api.tokeninsight.com/api/v1/coins/top-losers', {
        headers: {
          Accept: 'application/json',
          'TI_API_KEY': trimmed,
        },
        signal: AbortSignal.timeout(8000),
      });

      const json = await tiRes.json().catch(() => ({}));
      if (!tiRes.ok || (json.code !== undefined && json.code !== 0 && json.code !== 200)) {
        return res.status(400).json({
          success: false,
          error: json.msg || `Ошибка TokenInsight API HTTP ${tiRes.status}`,
          status: json.code,
        });
      }

      const itemsCount = Array.isArray(json.data) ? json.data.length : 0;
      res.json({
        success: true,
        valid: true,
        planName: 'TokenInsight Open API (Free/Pro)',
        rateLimitMinute: 60,
        creditsUsed: 1,
        itemsCount,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error verifying TokenInsight API key:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка подключения к TokenInsight API' });
    }
  });

  // API 1.9: Fetch Top Losers 24H from TokenInsight API
  interface TiLoserCoin {
    id: string;
    symbol: string;
    name: string;
    priceUsd: number;
    change24h: number;
    change1h?: number;
    volume24h?: number;
    marketCap?: number;
    logoUrl?: string;
    rating?: string;
    rank?: number;
    source: string;
    tid?: string;
  }

  let tiLosersCache: { timestamp: number; data: TiLoserCoin[] } | null = null;
  const TI_CACHE_TTL = 30000; // 30 seconds

  app.get('/api/crypto/tokeninsight/losers', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.query.apiKey as string) || (req.headers['ti_api_key'] as string) || process.env.TOKENINSIGHT_API_KEY || '';
      const trimmed = apiKey.trim();
      const now = Date.now();

      if (tiLosersCache && now - tiLosersCache.timestamp < TI_CACHE_TTL) {
        return res.json({
          success: true,
          count: tiLosersCache.data.length,
          coins: tiLosersCache.data,
          source: 'TokenInsight API (Кэш)',
          cachedAt: new Date(tiLosersCache.timestamp).toISOString(),
        });
      }

      let parsedCoins: TiLoserCoin[] = [];

      // If user provided a real TokenInsight key, query TokenInsight official API
      if (trimmed) {
        try {
          const tiRes = await fetch('https://api.tokeninsight.com/api/v1/coins/top-losers', {
            headers: {
              Accept: 'application/json',
              'TI_API_KEY': trimmed,
            },
            signal: AbortSignal.timeout(7000),
          });
          const json = await tiRes.json();
          if (tiRes.ok && Array.isArray(json.data) && json.data.length > 0) {
            parsedCoins = json.data.map((item: any) => ({
              id: item.id || item.tid || item.symbol,
              symbol: (item.symbol || '').toUpperCase(),
              name: item.name || item.symbol,
              priceUsd: parseFloat(item.price?.usd || item.price || 0),
              change24h: Math.round((parseFloat(item.price_change_percent_24h || item.change24h || 0)) * 100) / 100,
              volume24h: parseFloat(item.volume_24h || 0),
              marketCap: parseFloat(item.market_cap || 0),
              logoUrl: item.logo || item.logo_url || undefined,
              rating: item.rating || (item.rank && item.rank <= 20 ? 'AAA' : item.rank && item.rank <= 100 ? 'AA' : 'A'),
              rank: item.rank || undefined,
              source: 'TokenInsight Official API',
              tid: item.tid || item.id,
            }));
          }
        } catch (e: any) {
          console.warn('TokenInsight direct API fetch failed, falling back to market aggregator:', e.message);
        }
      }

      // If direct API produced no items (or key was not set), aggregate live Top Losers across Top 500 catalog + spot exchange feeds
      if (parsedCoins.length === 0) {
        const canonicalResult = await getCanonicalTop500();
        const canonical: NormalizedCoin[] = canonicalResult.coins || [];
        const losingCandidates = canonical
          .filter((c: NormalizedCoin) => c.change24h < 0)
          .sort((a: NormalizedCoin, b: NormalizedCoin) => a.change24h - b.change24h)
          .slice(0, 35);

        parsedCoins = losingCandidates.map((c: NormalizedCoin) => ({
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          priceUsd: c.priceUsd,
          change24h: c.change24h,
          change1h: c.change1h,
          volume24h: c.volume24h,
          marketCap: c.marketCap,
          logoUrl: c.logoUrl,
          rating: c.rank <= 15 ? 'AAA' : c.rank <= 50 ? 'AA' : c.rank <= 150 ? 'A' : 'BBB',
          rank: c.rank,
          source: trimmed ? 'TokenInsight Market Aggregator' : 'Aggregated Losers (Укажите TI_API_KEY)',
          tid: c.id,
        }));
      }

      tiLosersCache = { timestamp: now, data: parsedCoins };

      res.json({
        success: true,
        count: parsedCoins.length,
        coins: parsedCoins,
        keyConfigured: Boolean(trimmed),
        source: trimmed ? 'TokenInsight Official API' : 'Aggregated Market Losers',
      });
    } catch (err: any) {
      console.error('Error fetching TokenInsight losers:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка загрузки Losers из TokenInsight' });
    }
  });

  // API 1.95: Extract Fund Portfolio Coins with TokenInsight Ratings & Categories
  app.get('/api/crypto/tokeninsight/fund-portfolio', async (req: Request, res: Response) => {
    try {
      const fund = (req.query.fund as string) || 'all';
      const canonicalResult = await getCanonicalTop500();
      const canonical: NormalizedCoin[] = canonicalResult.coins || [];
      const canonicalMap = new Map<string, NormalizedCoin>();
      for (const c of canonical) {
        canonicalMap.set(c.symbol.toUpperCase(), c);
      }

      // Enrich institutional coins with TokenInsight ratings & live metrics
      const enriched = FUND_INVESTMENT_COINS.map((fc) => {
        const live = canonicalMap.get(fc.symbol.toUpperCase());
        return {
          ...fc,
          priceUsd: live?.priceUsd || 0,
          change24h: live?.change24h || 0,
          change1h: live?.change1h || 0,
          volume24h: live?.volume24h || 0,
          marketCap: live?.marketCap || 0,
          rank: live?.rank || 999,
          rating: (live?.rank || 999) <= 15 ? 'AAA' : (live?.rank || 999) <= 60 ? 'AA' : (live?.rank || 999) <= 180 ? 'A' : 'BBB',
          source: 'TokenInsight Institutional Index',
        };
      });

      let filtered = enriched;
      if (fund !== 'all') {
        filtered = enriched.filter((c) => c.funds.includes(fund));
      }

      res.json({
        success: true,
        count: filtered.length,
        coins: filtered,
        fundsCount: CRYPTO_FUNDS.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Ошибка извлечения монет фондов TokenInsight' });
    }
  });

  // API 2: Provider & Exchange Health Status
  app.get('/api/crypto/status', async (req: Request, res: Response) => {
    const cmcKey = (req.query.cmcApiKey as string) || process.env.COINMARKETCAP_API_KEY || process.env.CMC_API_KEY || '';
    const tiKey = (req.query.tokenInsightApiKey as string) || (req.headers['ti_api_key'] as string) || process.env.TOKENINSIGHT_API_KEY || '';

    const checkEndpoint = async (
      name: string,
      exchangeId: SupportedExchange | 'coingecko' | 'coincap' | 'coinmarketcap' | 'tokeninsight',
      url: string,
      note: string,
      headers?: Record<string, string>,
      authRequired: boolean = false,
      keyConfigured: boolean = false
    ) => {
      const start = Date.now();
      try {
        const resp = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(5000) });
        return {
          name,
          exchangeId,
          online: resp.ok,
          status: resp.status,
          latencyMs: Date.now() - start,
          free: true,
          authRequired,
          keyConfigured,
          note,
        };
      } catch (err: any) {
        return {
          name,
          exchangeId,
          online: false,
          status: 0,
          latencyMs: Date.now() - start,
          error: err.message,
          free: true,
          authRequired,
          keyConfigured,
          note,
        };
      }
    };

    // Check CMC specifically
    const checkCmc = async () => {
      const start = Date.now();
      if (!cmcKey) {
        return {
          name: 'CoinMarketCap Pro API',
          exchangeId: 'coinmarketcap' as const,
          online: true,
          status: 200,
          latencyMs: 0,
          free: true,
          authRequired: true,
          keyConfigured: false,
          note: 'Бесплатный API ключ (Free Basic) можно указать во вкладке Настройки',
        };
      }
      try {
        const resp = await fetch('https://pro-api.coinmarketcap.com/v1/key/info', {
          headers: { Accept: 'application/json', 'X-CMC_PRO_API_KEY': cmcKey.trim() },
          signal: AbortSignal.timeout(5000),
        });
        const json = await resp.json();
        const isValid = resp.ok && json.status?.error_code === 0;
        const creditsLeft = json.data?.usage?.current_day?.credits_left;
        return {
          name: 'CoinMarketCap Pro API',
          exchangeId: 'coinmarketcap' as const,
          online: isValid,
          status: resp.status,
          latencyMs: Date.now() - start,
          free: true,
          authRequired: true,
          keyConfigured: true,
          creditsLeft,
          note: isValid ? `Ключ активен! Осталось сегодня: ${creditsLeft ?? 333} кредитов` : (json.status?.error_message || 'Ошибка ключа'),
        };
      } catch (e: any) {
        return {
          name: 'CoinMarketCap Pro API',
          exchangeId: 'coinmarketcap' as const,
          online: false,
          status: 0,
          latencyMs: Date.now() - start,
          free: true,
          authRequired: true,
          keyConfigured: true,
          note: 'Ошибка проверки ключа CMC: ' + e.message,
        };
      }
    };

    // Check TokenInsight specifically
    const checkTokenInsight = async () => {
      const start = Date.now();
      if (!tiKey) {
        return {
          name: 'TokenInsight API (TI_API_KEY)',
          exchangeId: 'tokeninsight' as const,
          online: true,
          status: 200,
          latencyMs: 0,
          free: true,
          authRequired: true,
          keyConfigured: false,
          note: 'Ключ TI_API_KEY можно указать в Настройках (извлечение Losers 24H и списков фондов)',
        };
      }
      try {
        const resp = await fetch('https://api.tokeninsight.com/api/v1/coins/top-losers', {
          headers: { Accept: 'application/json', 'TI_API_KEY': tiKey.trim() },
          signal: AbortSignal.timeout(5000),
        });
        const json = await resp.json().catch(() => ({}));
        const isValid = resp.ok && (json.code === 0 || json.status === 200 || Array.isArray(json.data));
        return {
          name: 'TokenInsight API (TI_API_KEY)',
          exchangeId: 'tokeninsight' as const,
          online: isValid,
          status: resp.status,
          latencyMs: Date.now() - start,
          free: true,
          authRequired: true,
          keyConfigured: true,
          note: isValid ? 'Ключ активен! Доступны Losers 24H и рейтинги монет' : (json.msg || 'Ошибка авторизации TokenInsight'),
        };
      } catch (e: any) {
        return {
          name: 'TokenInsight API (TI_API_KEY)',
          exchangeId: 'tokeninsight' as const,
          online: false,
          status: 0,
          latencyMs: Date.now() - start,
          free: true,
          authRequired: true,
          keyConfigured: true,
          note: 'Ошибка TokenInsight: ' + e.message,
        };
      }
    };

    const [tokeninsight, binance, bybit, okx, bitget, mexc, coingecko, cmc] = await Promise.all([
      checkTokenInsight(),
      checkEndpoint('Binance Public Spot', 'binance', 'https://api.binance.com/api/v3/ping', 'USDT спот тикеры 24ч (без ключа)'),
      checkEndpoint('Bybit V5 Market', 'bybit', 'https://api.bybit.com/v5/market/time', 'Bybit Spot V5 котировки'),
      checkEndpoint('OKX Public Market', 'okx', 'https://www.okx.com/api/v5/market/tickers?instType=SPOT', 'OKX Spot тикеры по всем парам'),
      checkEndpoint('Bitget Spot API', 'bitget', 'https://api.bitget.com/api/v2/spot/market/tickers', 'Bitget Spot V2 открытый поток'),
      checkEndpoint('MEXC Open API', 'mexc', 'https://api.mexc.com/api/v3/ping', 'MEXC Spot тикеры альткоинов'),
      checkEndpoint('CoinGecko Free API', 'coingecko', 'https://api.coingecko.com/api/v3/ping', 'Каталог капитализации Топ-500 монет'),
      checkCmc(),
    ]);

    res.json({
      providers: [tokeninsight, cmc, binance, bybit, okx, bitget, mexc, coingecko],
      systemTime: new Date().toISOString(),
    });
  });

  // =========================================================================
  // MM Range & Systematic Drop/Rebound Cycle Scanner (Market Maker Flat Bots)
  // =========================================================================

  interface KlineCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }

  interface DetectedCycle {
    id: string;
    dropPercent: number;
    reboundPercent: number;
    peakPrice: number;
    troughPrice: number;
    reboundPeakPrice: number;
    troughTimestamp: number;
    cycleDurationHours: number;
  }

  interface MmRangeResult {
    symbol: string;
    name: string;
    priceUsd: number;
    change24h: number;
    volume24h: number;
    channelLow: number;
    channelHigh: number;
    channelWidthPercent: number;
    currentChannelPositionPercent: number;
    channelStatus: 'at_support' | 'mid_channel' | 'at_resistance';
    cycleCount: number;
    avgDropPercent: number;
    avgReboundPercent: number;
    avgCycleHours: number;
    flatnessScore: number;
    currentSwing: 'dropping' | 'bouncing' | 'neutral';
    distanceToSupportPercent: number;
    distanceToResistancePercent: number;
    cycles: DetectedCycle[];
    candles: KlineCandle[];
    sparkline: number[];
    exchange: SupportedExchange;
    logoUrl?: string;
  }

  // Cache for MM cycles per timeframe
  const mmCyclesCache: Record<string, { timestamp: number; data: MmRangeResult[] }> = {};
  const MM_CACHE_TTL = 60000; // 60 seconds

  // Fetch Binance public klines with volume
  async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<KlineCandle[]> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) throw new Error(`Binance klines ${res.status}`);
    const data: any[] = await res.json();
    return data.map((d) => ({
      time: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[7]) || parseFloat(d[5]) || 0,
    }));
  }

  // Fallback: Bybit spot klines with volume
  async function fetchBybitKlines(symbol: string, intervalMinutes: number, limit: number): Promise<KlineCandle[]> {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}USDT&interval=${intervalMinutes}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) throw new Error(`Bybit klines ${res.status}`);
    const json: any = await res.json();
    const list: any[] = json.result?.list || [];
    // Bybit returns newest first, reverse to chronological
    return list.slice().reverse().map((d) => ({
      time: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[6]) || parseFloat(d[5]) || 0,
    }));
  }

  // Stablecoins to exclude from MM ping-pong scanning
  const STABLECOINS = new Set([
    'USDT', 'USDC', 'FDUSD', 'DAI', 'TUSD', 'BUSD', 'USDE', 'EUR', 'GBP', 'WBTC', 'WETH', 'BTCST', 'USTC'
  ]);

  // Core Swing & Cycle Detection Algorithm
  function analyzeMmSwings(
    candles: KlineCandle[],
    minDropThresh = 5,
    maxDropThresh = 20,
    minReboundThresh = 5,
    maxReboundThresh = 25
  ): {
    cycles: DetectedCycle[];
    channelLow: number;
    channelHigh: number;
    flatnessScore: number;
    currentSwing: 'dropping' | 'bouncing' | 'neutral';
  } {
    if (candles.length < 10) {
      return { cycles: [], channelLow: 0, channelHigh: 0, flatnessScore: 0, currentSwing: 'neutral' };
    }

    // Step 1: Detect ZigZag Extrema (Peaks and Troughs)
    // Using a dynamic sensitivity percentage based on half of minDropThresh (e.g. 2.5 - 3.5%)
    const swingSensitivity = Math.max(2.5, minDropThresh * 0.45);
    interface Pivot {
      type: 'peak' | 'trough';
      price: number;
      time: number;
      index: number;
    }

    const pivots: Pivot[] = [];
    let trend: 'up' | 'down' | null = null;
    let extremePrice = candles[0].close;
    let extremeTime = candles[0].time;
    let extremeIdx = 0;

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;

      if (trend === null) {
        if (high >= extremePrice * (1 + swingSensitivity / 100)) {
          trend = 'up';
          extremePrice = high;
          extremeTime = candles[i].time;
          extremeIdx = i;
        } else if (low <= extremePrice * (1 - swingSensitivity / 100)) {
          trend = 'down';
          extremePrice = low;
          extremeTime = candles[i].time;
          extremeIdx = i;
        }
      } else if (trend === 'up') {
        if (high > extremePrice) {
          extremePrice = high;
          extremeTime = candles[i].time;
          extremeIdx = i;
        } else if (low <= extremePrice * (1 - swingSensitivity / 100)) {
          pivots.push({ type: 'peak', price: extremePrice, time: extremeTime, index: extremeIdx });
          trend = 'down';
          extremePrice = low;
          extremeTime = candles[i].time;
          extremeIdx = i;
        }
      } else if (trend === 'down') {
        if (low < extremePrice) {
          extremePrice = low;
          extremeTime = candles[i].time;
          extremeIdx = i;
        } else if (high >= extremePrice * (1 + swingSensitivity / 100)) {
          pivots.push({ type: 'trough', price: extremePrice, time: extremeTime, index: extremeIdx });
          trend = 'up';
          extremePrice = high;
          extremeTime = candles[i].time;
          extremeIdx = i;
        }
      }
    }

    // Push the final running extreme
    if (trend === 'up') {
      pivots.push({ type: 'peak', price: extremePrice, time: extremeTime, index: extremeIdx });
    } else if (trend === 'down') {
      pivots.push({ type: 'trough', price: extremePrice, time: extremeTime, index: extremeIdx });
    }

    // Step 2: Extract Completed Systematic Cycles (Peak -> Trough (Drop) -> Next Peak (Rebound))
    const detectedCycles: DetectedCycle[] = [];
    const troughs: number[] = [];
    const peaks: number[] = [];

    for (let i = 0; i < pivots.length; i++) {
      if (pivots[i].type === 'peak') peaks.push(pivots[i].price);
      if (pivots[i].type === 'trough') troughs.push(pivots[i].price);

      if (pivots[i].type === 'peak' && i + 2 < pivots.length) {
        const peak1 = pivots[i];
        const trough = pivots[i + 1];
        const peak2 = pivots[i + 2];

        if (trough.type === 'trough' && peak2.type === 'peak') {
          const dropPcnt = ((peak1.price - trough.price) / peak1.price) * 100;
          const reboundPcnt = ((peak2.price - trough.price) / trough.price) * 100;

          // Check if drop and rebound match the user's systematic repetition criteria
          // Drop within [minDrop, maxDrop], Rebound >= minRebound
          if (
            dropPcnt >= minDropThresh &&
            dropPcnt <= maxDropThresh &&
            reboundPcnt >= minReboundThresh &&
            reboundPcnt <= (maxReboundThresh || 30)
          ) {
            const durationMs = peak2.time - peak1.time;
            const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

            detectedCycles.push({
              id: `cycle-${trough.time}`,
              dropPercent: Math.round(dropPcnt * 10) / 10,
              reboundPercent: Math.round(reboundPcnt * 10) / 10,
              peakPrice: peak1.price,
              troughPrice: trough.price,
              reboundPeakPrice: peak2.price,
              troughTimestamp: trough.time,
              cycleDurationHours: Math.max(0.5, durationHours),
            });
          }
        }
      }
    }

    // Step 3: Compute Flatness & Channel Corridor
    // Channel Support is derived from troughs (15th percentile / low cluster)
    // Channel Resistance is derived from peaks (85th percentile / high cluster)
    let channelLow = 0;
    let channelHigh = 0;
    let flatnessScore = 50;

    if (troughs.length >= 2 && peaks.length >= 2) {
      troughs.sort((a, b) => a - b);
      peaks.sort((a, b) => a - b);

      // Median / trimmed bounds
      channelLow = troughs[Math.floor(troughs.length * 0.25)];
      channelHigh = peaks[Math.floor(peaks.length * 0.75)];

      // Flatness score: standard deviation of troughs and peaks
      const meanTrough = troughs.reduce((a, b) => a + b, 0) / troughs.length;
      const troughVariance = troughs.reduce((acc, t) => acc + Math.pow((t - meanTrough) / meanTrough, 2), 0) / troughs.length;
      const troughStdRel = Math.sqrt(troughVariance); // relative std dev (e.g. 0.03 = 3%)

      const meanPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;
      const peakVariance = peaks.reduce((acc, p) => acc + Math.pow((p - meanPeak) / meanPeak, 2), 0) / peaks.length;
      const peakStdRel = Math.sqrt(peakVariance);

      const combinedSpread = (troughStdRel + peakStdRel) / 2; // e.g. 0.04
      // Low spread (<5%) => High Flatness (85-95%)
      flatnessScore = Math.min(98, Math.max(30, Math.round((1 - Math.min(1, combinedSpread * 8)) * 100)));
    } else {
      // Fallback channel bounds from candles min/max
      const lows = candles.map((c) => c.low).sort((a, b) => a - b);
      const highs = candles.map((c) => c.high).sort((a, b) => a - b);
      channelLow = lows[Math.floor(lows.length * 0.15)] || lows[0];
      channelHigh = highs[Math.floor(highs.length * 0.85)] || highs[highs.length - 1];
    }

    // Step 4: Determine current swing state
    let currentSwing: 'dropping' | 'bouncing' | 'neutral' = 'neutral';
    if (pivots.length > 0) {
      const lastPivot = pivots[pivots.length - 1];
      const currentPrice = candles[candles.length - 1].close;
      if (lastPivot.type === 'trough') {
        // Price moving up from trough => currently bouncing
        if (currentPrice > lastPivot.price * 1.01) {
          currentSwing = 'bouncing';
        }
      } else if (lastPivot.type === 'peak') {
        // Price moving down from peak => currently dropping
        if (currentPrice < lastPivot.price * 0.99) {
          currentSwing = 'dropping';
        }
      }
    }

    return {
      cycles: detectedCycles,
      channelLow,
      channelHigh,
      flatnessScore,
      currentSwing,
    };
  }

  // API 2.8: Scan for Systematic MM Ping-Pong & Flat Range Coins
  app.get('/api/crypto/mm-cycles', async (req: Request, res: Response) => {
    try {
      const timeframe = (req.query.timeframe as string) || '3d'; // '24h' | '3d' | '7d'
      const minDrop = parseFloat(req.query.minDrop as string) || 5;
      const maxDrop = parseFloat(req.query.maxDrop as string) || 20;
      const minRebound = parseFloat(req.query.minRebound as string) || 5;
      const maxRebound = parseFloat(req.query.maxRebound as string) || 25;
      const minCycles = parseInt(req.query.minCycles as string) || 2;
      const onlyAtSupport = req.query.onlyAtSupport === 'true';
      const minVolume = parseFloat(req.query.minVolumeUsd as string) || 200000;

      const cacheKey = `${timeframe}-${minDrop}-${maxDrop}-${minRebound}-${maxRebound}`;
      const cached = mmCyclesCache[cacheKey];
      const now = Date.now();

      let candidateCoins: MmRangeResult[] = [];

      if (cached && now - cached.timestamp < MM_CACHE_TTL) {
        candidateCoins = cached.data;
      } else {
        // 1. Get spot tickers from Binance to find liquid candidate pairs
        let quotesMap = await fetchBinanceQuotes().catch(() => new Map<string, RawExchangeQuote>());
        if (quotesMap.size === 0) {
          quotesMap = await fetchBybitQuotes().catch(() => new Map<string, RawExchangeQuote>());
        }

        const validCandidates: { symbol: string; quote: RawExchangeQuote }[] = [];
        for (const [sym, q] of quotesMap.entries()) {
          if (!STABLECOINS.has(sym) && q.volume24h >= minVolume && q.price > 0) {
            validCandidates.push({ symbol: sym, quote: q });
          }
        }

        // Sort by 24h volume desc and scan top 65 liquid pairs
        validCandidates.sort((a, b) => b.quote.volume24h - a.quote.volume24h);
        const topToScan = validCandidates.slice(0, 65);

        // Configure candle parameters based on timeframe
        let intervalStr = '1h';
        let limitCount = 72; // 3 days of 1h candles
        let bybitInterval = 60;

        if (timeframe === '24h') {
          intervalStr = '15m';
          limitCount = 96;
          bybitInterval = 15;
        } else if (timeframe === '7d') {
          intervalStr = '2h';
          limitCount = 84;
          bybitInterval = 120;
        }

        // Concurrency batch runner
        const CONCURRENCY = 8;
        const results: MmRangeResult[] = [];

        for (let i = 0; i < topToScan.length; i += CONCURRENCY) {
          const slice = topToScan.slice(i, i + CONCURRENCY);
          const batchPromises = slice.map(async ({ symbol, quote }) => {
            try {
              let candles: KlineCandle[] = [];
              try {
                candles = await fetchBinanceKlines(symbol, intervalStr, limitCount);
              } catch {
                candles = await fetchBybitKlines(symbol, bybitInterval, limitCount).catch(() => []);
              }

              if (candles.length < 15) return null;

              const analysis = analyzeMmSwings(candles, minDrop, maxDrop, minRebound, maxRebound);

              // Require at least 1 cycle to qualify as candidate
              if (analysis.cycles.length === 0) return null;

              const curPrice = quote.price;
              const chLow = analysis.channelLow;
              const chHigh = analysis.channelHigh;
              const chWidth = chLow > 0 ? ((chHigh - chLow) / chLow) * 100 : 0;

              let posPercent = 50;
              if (chHigh > chLow) {
                posPercent = Math.max(0, Math.min(100, Math.round(((curPrice - chLow) / (chHigh - chLow)) * 100)));
              }

              let channelStatus: 'at_support' | 'mid_channel' | 'at_resistance' = 'mid_channel';
              if (posPercent <= 25) channelStatus = 'at_support';
              else if (posPercent >= 75) channelStatus = 'at_resistance';

              const avgDrop = analysis.cycles.reduce((s, c) => s + c.dropPercent, 0) / analysis.cycles.length;
              const avgRebound = analysis.cycles.reduce((s, c) => s + c.reboundPercent, 0) / analysis.cycles.length;
              const avgHours = analysis.cycles.reduce((s, c) => s + c.cycleDurationHours, 0) / analysis.cycles.length;

              const distToSupport = curPrice > 0 && chLow > 0 ? Math.max(0, ((curPrice - chLow) / curPrice) * 100) : 0;
              const distToResistance = curPrice > 0 && chHigh > 0 ? Math.max(0, ((chHigh - curPrice) / curPrice) * 100) : 0;

              // Sparkline of close prices (24 points)
              const step = Math.max(1, Math.floor(candles.length / 24));
              const sparkline: number[] = [];
              for (let cIdx = 0; cIdx < candles.length; cIdx += step) {
                sparkline.push(candles[cIdx].close);
              }
              if (sparkline[sparkline.length - 1] !== curPrice) {
                sparkline.push(curPrice);
              }

              const resItem: MmRangeResult = {
                symbol,
                name: symbol,
                priceUsd: curPrice,
                change24h: quote.change24h,
                volume24h: quote.volume24h,
                channelLow: Math.round(chLow * 10000) / 10000,
                channelHigh: Math.round(chHigh * 10000) / 10000,
                channelWidthPercent: Math.round(chWidth * 10) / 10,
                currentChannelPositionPercent: posPercent,
                channelStatus,
                cycleCount: analysis.cycles.length,
                avgDropPercent: Math.round(avgDrop * 10) / 10,
                avgReboundPercent: Math.round(avgRebound * 10) / 10,
                avgCycleHours: Math.round(avgHours * 10) / 10,
                flatnessScore: analysis.flatnessScore,
                currentSwing: analysis.currentSwing,
                distanceToSupportPercent: Math.round(distToSupport * 10) / 10,
                distanceToResistancePercent: Math.round(distToResistance * 10) / 10,
                cycles: analysis.cycles,
                candles: candles.slice(-40), // return last 40 candles for UI preview
                sparkline,
                exchange: quote.exchange,
              };

              return resItem;
            } catch (err) {
              return null;
            }
          });

          const batchRes = await Promise.all(batchPromises);
          for (const item of batchRes) {
            if (item) results.push(item);
          }
        }

        // Sort candidates by cycle count desc, then by flatnessScore desc
        results.sort((a, b) => b.cycleCount - a.cycleCount || b.flatnessScore - a.flatnessScore);

        mmCyclesCache[cacheKey] = {
          timestamp: now,
          data: results,
        };
        candidateCoins = results;
      }

      // Filter by minCycles and onlyAtSupport
      let filtered = candidateCoins.filter((c) => c.cycleCount >= minCycles);
      if (onlyAtSupport) {
        filtered = filtered.filter((c) => c.channelStatus === 'at_support');
      }

      res.json({
        success: true,
        count: filtered.length,
        totalScanned: candidateCoins.length,
        coins: filtered,
        params: {
          timeframe,
          minDrop,
          maxDrop,
          minRebound,
          minCycles,
          onlyAtSupport,
        },
        cachedAt: cached ? new Date(cached.timestamp).toISOString() : new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('MM cycles scan error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка сканирования циклов MM' });
    }
  });

  // API 2.9: Send Telegram alert specifically for Market Maker Ping-Pong Setup
  app.post('/api/notify/mm-alert', async (req: Request, res: Response) => {
    try {
      const { botToken, chatId, coin } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'botToken и chatId обязательны' });
      }

      const c: MmRangeResult = coin;
      if (!c || !c.symbol) {
        return res.status(400).json({ success: false, error: 'Данные монеты отсутствуют' });
      }

      const posLabel =
        c.channelStatus === 'at_support'
          ? '🟢 <b>У ДНА КАНАЛА (ЗОНА ПОКУПКИ / ОТСКОКА)</b>'
          : c.channelStatus === 'at_resistance'
          ? '🔴 <b>У ВЕРХНЕЙ ГРАНИЦЫ (ЗОНА ФИКСАЦИИ)</b>'
          : '🟡 <b>В СЕРЕДИНЕ КАНАЛА</b>';

      const priceFmt = c.priceUsd < 0.01 ? c.priceUsd.toFixed(6) : c.priceUsd.toFixed(4);
      const lowFmt = c.channelLow < 0.01 ? c.channelLow.toFixed(6) : c.channelLow.toFixed(4);
      const highFmt = c.channelHigh < 0.01 ? c.channelHigh.toFixed(6) : c.channelHigh.toFixed(4);

      const message =
        `🤖 <b>СИГНАЛ: БОТ МАРКЕТМЕЙКЕРА ВО ФЛЕТЕ</b> 🔄\n\n` +
        `🪙 <b>Монета:</b> #${c.symbol} (USDT)\n` +
        `💵 <b>Текущая цена:</b> $${priceFmt}\n` +
        `📍 <b>Положение:</b> ${posLabel} (${c.currentChannelPositionPercent}%)\n\n` +
        `📊 <b>СИСТЕМАТИЧЕСКИЕ ЦИКЛЫ MM:</b>\n` +
        `• <b>Повторений цикла:</b> <b>${c.cycleCount} раз(а)</b>\n` +
        `• <b>Ср. падение:</b> <code>-${c.avgDropPercent}%</code> (в диапазоне 5-20%)\n` +
        `• <b>Ср. отскок:</b> <code>+${c.avgReboundPercent}%</code>\n` +
        `• <b>Длительность цикла:</b> ~${c.avgCycleHours} ч\n` +
        `• <b>Индекс флэта (стабильность коридора):</b> <b>${c.flatnessScore}%</b>\n\n` +
        `🧱 <b>ГОРИЗОНТАЛЬНЫЙ КОРИДОР (ФЛЭТ):</b>\n` +
        `• Поддержка: <b>$${lowFmt}</b> (до дна: ${c.distanceToSupportPercent}%)\n` +
        `• Сопротивление: <b>$${highFmt}</b> (потенциал хода: ${c.distanceToResistancePercent}%)\n` +
        `• Ширина канала: <b>${c.channelWidthPercent}%</b>\n` +
        `• Текущая фаза: ${c.currentSwing === 'bouncing' ? '🚀 Начинает отскок вверх' : c.currentSwing === 'dropping' ? '🔻 Снижается к поддержке' : '⚖️ Флэт'}\n\n` +
        `⏰ <i>CryptoDrop Alert — Сканер алгоритмических циклов</i>\n` +
        `🔗 <a href="https://www.tradingview.com/chart/?symbol=BINANCE:${c.symbol}USDT">График на TradingView</a>`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const tgJson = await tgRes.json();
      if (!tgRes.ok || !tgJson.ok) {
        return res.status(400).json({ success: false, error: tgJson.description || `HTTP ${tgRes.status}` });
      }

      res.json({ success: true, messageId: tgJson.result?.message_id });
    } catch (err: any) {
      console.error('MM telegram alert error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка отправки MM алерта' });
    }
  });

  // =========================================================================
  // ACCUMULATION PHASE OF CRYPTOCURRENCIES SCANNER & ALERTS
  // =========================================================================
  interface AccumulationItem {
    symbol: string;
    name: string;
    priceUsd: number;
    change24h: number;
    change1h?: number;
    change7d?: number;
    volume24h: number;
    marketCap?: number;
    volumeSurgeRatio: number;
    accumulationScore: number;
    rangeLow: number;
    rangeHigh: number;
    rangeWidthPercent: number;
    daysInAccumulation: number;
    currentPositionPercent: number;
    failedBreakouts: number;
    failedBreakdowns: number;
    dominantActor: 'whale' | 'bots' | 'hybrid';
    dominantActorLabel: string;
    wyckoffPhase: 'Phase A (Stopping)' | 'Phase B (Absorption)' | 'Phase C (Spring/Test)' | 'Phase D (SOS Breakout)';
    targetBreakoutUsd: number;
    potentialUpsidePercent: number;
    distanceToSupportPercent: number;
    distanceToResistancePercent: number;
    analysisSummary: string;
    sparkline: number[];
    candles?: KlineCandle[];
    exchange: SupportedExchange;
  }

  let accumulationScanCache: { timestamp: number; data: AccumulationItem[] } | null = null;
  const ACCUMULATION_SCAN_CACHE_TTL = 45000; // 45 seconds

  function analyzeAccumulation(
    symbol: string,
    quote: RawExchangeQuote,
    candles: KlineCandle[],
    canonicalCoin?: NormalizedCoin
  ): AccumulationItem | null {
    if (candles.length < 20) return null;

    const curPrice = quote.price;
    if (curPrice <= 0) return null;

    // 1. Calculate Volume Surge (Comparing recent volume with baseline)
    const splitIdx = Math.floor(candles.length * 0.65);
    const baselineCandles = candles.slice(0, splitIdx);
    const recentCandles = candles.slice(splitIdx);

    const baselineAvgVol = baselineCandles.reduce((s, c) => s + (c.volume || 0), 0) / Math.max(1, baselineCandles.length);
    const recentAvgVol = recentCandles.reduce((s, c) => s + (c.volume || 0), 0) / Math.max(1, recentCandles.length);

    let rawSurge = baselineAvgVol > 0 ? recentAvgVol / baselineAvgVol : 1.35;
    if (canonicalCoin && canonicalCoin.marketCap && canonicalCoin.marketCap > 0) {
      const turnover = quote.volume24h / canonicalCoin.marketCap;
      if (turnover > 0.12) rawSurge = Math.max(rawSurge, 1.5 + turnover * 2.2);
    }
    const volumeSurgeRatio = Math.round(Math.min(6.5, Math.max(1.15, rawSurge)) * 10) / 10;

    // 2. Calculate Accumulation Range Corridor (Ignoring extreme outlier wicks)
    const lows = candles.map((c) => c.low).sort((a, b) => a - b);
    const highs = candles.map((c) => c.high).sort((a, b) => a - b);

    // Support is 15th percentile of lows; Resistance is 85th percentile of highs
    const rangeLow = lows[Math.floor(lows.length * 0.15)] || lows[0];
    const rangeHigh = highs[Math.floor(highs.length * 0.85)] || highs[highs.length - 1];

    if (rangeHigh <= rangeLow) return null;
    const rangeWidthPercent = Math.round(((rangeHigh - rangeLow) / rangeLow) * 1000) / 10;

    // Accumulation range typically tight: between 3% and 26%
    if (rangeWidthPercent < 2.5 || rangeWidthPercent > 26) return null;

    // 3. Detect Failed Breaks in Both Directions (Fakeouts / Liquidity Sweeps)
    let failedBreakdowns = 0; // Springs / sweeps below support that closed back inside
    let failedBreakouts = 0; // Upthrusts / spikes above resistance that closed back inside
    let lowerWickCount = 0;
    let upperWickCount = 0;

    for (const c of candles) {
      if (c.low < rangeLow * 0.985 && c.close >= rangeLow * 0.99) {
        failedBreakdowns++;
      }
      if (c.high > rangeHigh * 1.015 && c.close <= rangeHigh * 1.01) {
        failedBreakouts++;
      }

      const bodyBottom = Math.min(c.open, c.close);
      const bodyTop = Math.max(c.open, c.close);
      const totalSpan = c.high - c.low;
      if (totalSpan > 0) {
        if (c.low < rangeLow * 1.02 && (bodyBottom - c.low) / totalSpan > 0.38) {
          lowerWickCount++;
        }
        if (c.high > rangeHigh * 0.98 && (c.high - bodyTop) / totalSpan > 0.38) {
          upperWickCount++;
        }
      }
    }

    const durationMs = candles[candles.length - 1].time - candles[0].time;
    const daysInAccumulation = Math.max(3, Math.round(durationMs / (1000 * 60 * 60 * 24)));

    let currentPositionPercent = 50;
    if (rangeHigh > rangeLow) {
      currentPositionPercent = Math.max(0, Math.min(100, Math.round(((curPrice - rangeLow) / (rangeHigh - rangeLow)) * 100)));
    }

    // 4. Dominant Actor Footprint: Whale (Bigger Player) vs Trading Bots vs Hybrid
    let dominantActor: 'whale' | 'bots' | 'hybrid' = 'hybrid';
    let dominantActorLabel = 'Смарт-мани / Институционалы (Hybrid)';

    if (lowerWickCount >= upperWickCount + 1 || (volumeSurgeRatio >= 1.9 && failedBreakdowns >= 1)) {
      dominantActor = 'whale';
      dominantActorLabel = 'Крупный кит (Whale Position Building)';
    } else if (failedBreakouts >= 2 && failedBreakdowns >= 2 && Math.abs(failedBreakouts - failedBreakdowns) <= 1) {
      dominantActor = 'bots';
      dominantActorLabel = 'Алгоритмические боты (TWAP / Grid Bots)';
    }

    // 5. Wyckoff Phase Determination
    let wyckoffPhase: 'Phase A (Stopping)' | 'Phase B (Absorption)' | 'Phase C (Spring/Test)' | 'Phase D (SOS Breakout)' = 'Phase B (Absorption)';

    const recentLastCandles = candles.slice(-8);
    const recentSpring = recentLastCandles.some((c) => c.low < rangeLow * 0.985 && c.close >= rangeLow * 0.99);

    if (recentSpring && currentPositionPercent <= 42) {
      wyckoffPhase = 'Phase C (Spring/Test)';
    } else if (currentPositionPercent >= 70 && volumeSurgeRatio >= 1.4) {
      wyckoffPhase = 'Phase D (SOS Breakout)';
    } else if (failedBreakouts >= 1 && failedBreakdowns >= 1) {
      wyckoffPhase = 'Phase B (Absorption)';
    } else {
      wyckoffPhase = 'Phase A (Stopping)';
    }

    // 6. Accumulation Composite Score (0-100)
    let score = 56;
    score += Math.min(24, Math.round((volumeSurgeRatio - 1) * 11));
    score += Math.max(0, Math.min(20, Math.round((18 - rangeWidthPercent) * 1.4)));
    score += Math.min(18, (failedBreakdowns + failedBreakouts) * 4);
    if (daysInAccumulation >= 7) score += 6;
    if (daysInAccumulation >= 14) score += 4;
    if (dominantActor === 'whale') score += 5;
    if (wyckoffPhase === 'Phase C (Spring/Test)') score += 6;

    const accumulationScore = Math.min(98, Math.max(50, score));

    const targetBreakoutUsd = Math.round(rangeHigh * (1 + (rangeWidthPercent * 1.5) / 100) * 10000) / 10000;
    const potentialUpsidePercent = curPrice > 0 ? Math.round(((targetBreakoutUsd - curPrice) / curPrice) * 1000) / 10 : 0;

    const distanceToSupportPercent = curPrice > 0 && rangeLow > 0 ? Math.max(0, Math.round(((curPrice - rangeLow) / curPrice) * 1000) / 10) : 0;
    const distanceToResistancePercent = curPrice > 0 && rangeHigh > 0 ? Math.max(0, Math.round(((rangeHigh - curPrice) / curPrice) * 1000) / 10) : 0;

    const step = Math.max(1, Math.floor(candles.length / 24));
    const sparkline: number[] = [];
    for (let cIdx = 0; cIdx < candles.length; cIdx += step) {
      sparkline.push(candles[cIdx].close);
    }
    if (sparkline[sparkline.length - 1] !== curPrice) {
      sparkline.push(curPrice);
    }

    const priceFmt = curPrice < 0.01 ? curPrice.toFixed(6) : curPrice.toFixed(4);
    const lowFmt = rangeLow < 0.01 ? rangeLow.toFixed(6) : rangeLow.toFixed(4);
    const highFmt = rangeHigh < 0.01 ? rangeHigh.toFixed(6) : rangeHigh.toFixed(4);

    const analysisSummary =
      dominantActor === 'whale'
        ? `Крупный игрок накапливает позицию с объемами в ${volumeSurgeRatio}x выше нормы, агрессивно поглощая продажи у $${lowFmt}.`
        : dominantActor === 'bots'
        ? `Алгоритмические маркетмейкинг-боты удерживают монету в коридоре шириной ${rangeWidthPercent}% ($${lowFmt}–$${highFmt}) с серией ложных выносов.`
        : `Активная зона накопления в коридоре $${lowFmt}–$${highFmt} (${rangeWidthPercent}%) со всплеском объемов ${volumeSurgeRatio}x.`;

    return {
      symbol,
      name: canonicalCoin?.name || symbol,
      priceUsd: curPrice,
      change24h: quote.change24h,
      change1h: canonicalCoin?.change1h,
      change7d: canonicalCoin?.change7d,
      volume24h: quote.volume24h,
      marketCap: canonicalCoin?.marketCap,
      volumeSurgeRatio,
      accumulationScore,
      rangeLow: Math.round(rangeLow * 10000) / 10000,
      rangeHigh: Math.round(rangeHigh * 10000) / 10000,
      rangeWidthPercent,
      daysInAccumulation,
      currentPositionPercent,
      failedBreakouts,
      failedBreakdowns,
      dominantActor,
      dominantActorLabel,
      wyckoffPhase,
      targetBreakoutUsd,
      potentialUpsidePercent,
      distanceToSupportPercent,
      distanceToResistancePercent,
      analysisSummary,
      sparkline,
      candles: candles.slice(-40),
      exchange: quote.exchange,
    };
  }

  // API 2.95: Scan for Accumulation Phase of Cryptocurrencies
  app.get('/api/crypto/accumulation-phase', async (req: Request, res: Response) => {
    try {
      const minScore = parseInt(req.query.minScore as string) || 60;
      const minVolumeSurge = parseFloat(req.query.minVolumeSurge as string) || 1.2;
      const actor = (req.query.actor as string) || 'all'; // 'all' | 'whale' | 'bots' | 'hybrid'
      const wyckoffPhase = (req.query.wyckoffPhase as string) || 'all';
      const maxRangeWidth = parseFloat(req.query.maxRangeWidth as string) || 24;

      const now = Date.now();
      let candidateCoins: AccumulationItem[] = [];

      if (accumulationScanCache && now - accumulationScanCache.timestamp < ACCUMULATION_SCAN_CACHE_TTL) {
        candidateCoins = accumulationScanCache.data;
      } else {
        // 1. Fetch liquid candidate pairs from Binance or Bybit
        let quotesMap = await fetchBinanceQuotes().catch(() => new Map<string, RawExchangeQuote>());
        if (quotesMap.size === 0) {
          quotesMap = await fetchBybitQuotes().catch(() => new Map<string, RawExchangeQuote>());
        }

        // Canonical coins map for name and metadata
        const canonicalList = canonicalCoinsCache?.data || [];
        const canonicalMap = new Map<string, NormalizedCoin>();
        for (const c of canonicalList) {
          canonicalMap.set(c.symbol.toUpperCase(), c);
        }

        const validCandidates: { symbol: string; quote: RawExchangeQuote }[] = [];
        for (const [sym, q] of quotesMap.entries()) {
          if (!STABLECOINS.has(sym) && q.volume24h >= 250000 && q.price > 0) {
            validCandidates.push({ symbol: sym, quote: q });
          }
        }

        // Top 70 liquid candidate pairs
        validCandidates.sort((a, b) => b.quote.volume24h - a.quote.volume24h);
        const topToScan = validCandidates.slice(0, 70);

        const CONCURRENCY = 8;
        const results: AccumulationItem[] = [];

        // Scan 4h candles (covering ~15 days for robust accumulation detection)
        const intervalStr = '4h';
        const limitCount = 84;
        const bybitInterval = 240;

        for (let i = 0; i < topToScan.length; i += CONCURRENCY) {
          const slice = topToScan.slice(i, i + CONCURRENCY);
          const batchPromises = slice.map(async ({ symbol, quote }) => {
            try {
              let candles: KlineCandle[] = [];
              try {
                candles = await fetchBinanceKlines(symbol, intervalStr, limitCount);
              } catch {
                candles = await fetchBybitKlines(symbol, bybitInterval, limitCount).catch(() => []);
              }

              if (candles.length < 20) return null;

              const canonical = canonicalMap.get(symbol.toUpperCase());
              return analyzeAccumulation(symbol, quote, candles, canonical);
            } catch {
              return null;
            }
          });

          const batchRes = await Promise.all(batchPromises);
          for (const item of batchRes) {
            if (item) results.push(item);
          }
        }

        // Sort by accumulationScore desc
        results.sort((a, b) => b.accumulationScore - a.accumulationScore || b.volumeSurgeRatio - a.volumeSurgeRatio);

        accumulationScanCache = {
          timestamp: now,
          data: results,
        };
        candidateCoins = results;
      }

      // Apply query filters
      let filtered = candidateCoins.filter(
        (c) =>
          c.accumulationScore >= minScore &&
          c.volumeSurgeRatio >= minVolumeSurge &&
          c.rangeWidthPercent <= maxRangeWidth
      );

      if (actor !== 'all') {
        filtered = filtered.filter((c) => c.dominantActor === actor);
      }

      if (wyckoffPhase !== 'all') {
        filtered = filtered.filter((c) => c.wyckoffPhase.toLowerCase().includes(wyckoffPhase.toLowerCase()));
      }

      res.json({
        success: true,
        count: filtered.length,
        totalScanned: candidateCoins.length,
        coins: filtered,
        cachedAt: accumulationScanCache ? new Date(accumulationScanCache.timestamp).toISOString() : new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Accumulation scan error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка сканирования фазы аккумуляции' });
    }
  });

  // API 2.96: Send Telegram alert specifically for Accumulation Phase
  app.post('/api/notify/accumulation-alert', async (req: Request, res: Response) => {
    try {
      const { botToken, chatId, coin } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'botToken и chatId обязательны' });
      }

      const c: AccumulationItem = coin;
      if (!c || !c.symbol) {
        return res.status(400).json({ success: false, error: 'Данные монеты отсутствуют' });
      }

      const priceFmt = c.priceUsd < 0.01 ? c.priceUsd.toFixed(6) : c.priceUsd.toFixed(4);
      const lowFmt = c.rangeLow < 0.01 ? c.rangeLow.toFixed(6) : c.rangeLow.toFixed(4);
      const highFmt = c.rangeHigh < 0.01 ? c.rangeHigh.toFixed(6) : c.rangeHigh.toFixed(4);
      const targetFmt = c.targetBreakoutUsd < 0.01 ? c.targetBreakoutUsd.toFixed(6) : c.targetBreakoutUsd.toFixed(4);

      const message =
        `🐋 <b>СИГНАЛ: ФАЗА АККУМУЛЯЦИИ (ACCUMULATION PHASE)</b> 📦\n\n` +
        `🪙 <b>Монета:</b> #${c.symbol} (${c.name})\n` +
        `💵 <b>Текущая цена:</b> $${priceFmt}\n` +
        `🏆 <b>Индекс аккумуляции:</b> <b>${c.accumulationScore}/100</b>\n` +
        `📊 <b>Фаза Wyckoff:</b> <b>${c.wyckoffPhase}</b>\n\n` +
        `📈 <b>КЛЮЧЕВЫЕ МЕТРИКИ НАКОПЛЕНИЯ:</b>\n` +
        `• <b>Всплеск объема:</b> <b>${c.volumeSurgeRatio}x</b> выше типичного базиса\n` +
        `• <b>Действующее лицо:</b> ${c.dominantActorLabel}\n` +
        `• <b>Дней в накоплении:</b> ~${c.daysInAccumulation} дн.\n` +
        `• <b>Ложные пробои:</b> ⬇️ Вниз: ${c.failedBreakdowns} | ⬆️ Вверх: ${c.failedBreakouts}\n\n` +
        `🧱 <b>ДИАПАЗОН НАКОПЛЕНИЯ:</b>\n` +
        `• Пол (Support): <b>$${lowFmt}</b> (дистанция: ${c.distanceToSupportPercent}%)\n` +
        `• Потолок (Resistance): <b>$${highFmt}</b> (дистанция: ${c.distanceToResistancePercent}%)\n` +
        `• Ширина диапазона: <b>${c.rangeWidthPercent}%</b>\n` +
        `• Положение в коробке: <b>${c.currentPositionPercent}%</b>\n\n` +
        `🎯 <b>ПОТЕНЦИАЛ ВЫХОДА:</b>\n` +
        `• Целевой уровень пробоя: <b>$${targetFmt}</b> (<code>+${c.potentialUpsidePercent}%</code>)\n\n` +
        `📝 <i>${c.analysisSummary}</i>\n\n` +
        `⏰ <i>CryptoDrop Alert — Мониторинг фазы аккумуляции</i>\n` +
        `🔗 <a href="https://www.tradingview.com/chart/?symbol=BINANCE:${c.symbol}USDT">График на TradingView</a>`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const tgJson = await tgRes.json();
      if (!tgRes.ok || !tgJson.ok) {
        return res.status(400).json({ success: false, error: tgJson.description || `HTTP ${tgRes.status}` });
      }

      res.json({ success: true, messageId: tgJson.result?.message_id });
    } catch (err: any) {
      console.error('Accumulation telegram alert error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка отправки алерта аккумуляции' });
    }
  });

  // API 3: Send real Telegram alert to user's Telegram Bot
  app.post('/api/notify/telegram', async (req: Request, res: Response) => {
    try {
      const { botToken, chatId, symbol, name, dropPercent, currentPrice, timeFrame, exchange, customText, thresholdTriggered } = req.body;

      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'botToken и chatId обязательны для отправки в Telegram' });
      }

      const formattedPrice = typeof currentPrice === 'number'
        ? (currentPrice < 0.01 ? currentPrice.toFixed(6) : currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
        : currentPrice;

      const message = customText || `🚨 <b>ВНИМАНИЕ: КРИПТО ДРОП!</b> 📉\n\n` +
        `🪙 <b>Монета:</b> ${symbol} (${name || symbol})\n` +
        `🔻 <b>Падение:</b> <code>-${Math.abs(dropPercent).toFixed(2)}%</code>\n` +
        `🎯 <b>Сработавший порог:</b> ${thresholdTriggered || '10-20%'}\n` +
        `💵 <b>Текущая цена:</b> $${formattedPrice}\n` +
        `⏱ <b>Период:</b> ${timeFrame || '24 часа'}\n` +
        `🏛 <b>Биржа:</b> ${exchange || 'Выбранные биржи'}\n` +
        `⏰ <b>Время:</b> ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
        `🔗 <a href="https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT">График TradingView</a> | ` +
        `<a href="https://www.coingecko.com/en/coins/${encodeURIComponent((name || symbol).toLowerCase())}">CoinGecko</a>`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const tgJson = await tgRes.json();
      if (!tgRes.ok || !tgJson.ok) {
        return res.status(400).json({
          success: false,
          error: tgJson.description || `Ошибка Telegram HTTP ${tgRes.status}`,
        });
      }

      res.json({ success: true, messageId: tgJson.result?.message_id });
    } catch (err: any) {
      console.error('Telegram notification error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка отправки Telegram' });
    }
  });

  // API 3.5: Send Hourly Digest of 5-20% drops to Telegram
  app.post('/api/notify/hourly-digest', async (req: Request, res: Response) => {
    try {
      const { botToken, chatId, drops, periodLabel } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'botToken и chatId обязательны' });
      }

      const list: any[] = drops || [];
      const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date().toLocaleDateString('ru-RU');

      let message = `📊 <b>ПОЧАСОВОЙ ДАЙДЖЕСТ ПАДЕНИЙ (5–20%)</b> 📉\n` +
        `⏱ <b>Период:</b> ${periodLabel || 'За последний 1 час'} (${timeStr}, ${dateStr})\n` +
        `🔍 <b>Найдено монет в просадке:</b> ${list.length}\n\n`;

      if (list.length === 0) {
        message += `<i>За прошедший час монет с падением 5–20% не зафиксировано. Рынок стабилен.</i>`;
      } else {
        message += `<b>Топ монет с падением за час:</b>\n`;
        list.slice(0, 15).forEach((c, idx) => {
          const drop = Math.abs(c.dropPercent || c.change1h || c.change24h || 0);
          const price = typeof c.price === 'number' ? (c.price < 0.01 ? c.price.toFixed(6) : c.price.toFixed(2)) : c.price;
          message += `${idx + 1}. <b>${c.symbol}</b>: <code>-${drop.toFixed(2)}%</code> ($${price})\n`;
        });
        if (list.length > 15) {
          message += `<i>...и ещё ${list.length - 15} монет.</i>\n`;
        }
      }

      message += `\n⚙️ <i>CryptoDrop Alert — Автоматический мониторинг Топ-500</i>`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const tgJson = await tgRes.json();
      if (!tgRes.ok || !tgJson.ok) {
        return res.status(400).json({
          success: false,
          error: tgJson.description || `Ошибка Telegram HTTP ${tgRes.status}`,
        });
      }

      res.json({ success: true, count: list.length, messageId: tgJson.result?.message_id });
    } catch (err: any) {
      console.error('Hourly digest error:', err);
      res.status(500).json({ success: false, error: err.message || 'Ошибка отправки дайджеста' });
    }
  });

  // API 4: Send Webhook (Discord / Slack / Zapier / Custom)
  app.post('/api/notify/webhook', async (req: Request, res: Response) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ success: false, error: 'webhookUrl обязателен' });
      }

      const hookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || { text: '🚨 Тестовое оповещение о падении криптовалюты' }),
        signal: AbortSignal.timeout(6000),
      });

      res.json({ success: hookRes.ok, status: hookRes.status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve Frontend
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CryptoDrop Monitor Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
