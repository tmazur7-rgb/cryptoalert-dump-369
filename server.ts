import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // API 2: Provider & Exchange Health Status
  app.get('/api/crypto/status', async (req: Request, res: Response) => {
    const cmcKey = (req.query.cmcApiKey as string) || process.env.COINMARKETCAP_API_KEY || process.env.CMC_API_KEY || '';
    const checkEndpoint = async (
      name: string,
      exchangeId: SupportedExchange | 'coingecko' | 'coincap' | 'coinmarketcap',
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

    const [binance, bybit, okx, bitget, mexc, coingecko, cmc] = await Promise.all([
      checkEndpoint('Binance Public Spot', 'binance', 'https://api.binance.com/api/v3/ping', 'USDT спот тикеры 24ч (без ключа)'),
      checkEndpoint('Bybit V5 Market', 'bybit', 'https://api.bybit.com/v5/market/time', 'Bybit Spot V5 котировки'),
      checkEndpoint('OKX Public Market', 'okx', 'https://www.okx.com/api/v5/market/tickers?instType=SPOT', 'OKX Spot тикеры по всем парам'),
      checkEndpoint('Bitget Spot API', 'bitget', 'https://api.bitget.com/api/v2/spot/market/tickers', 'Bitget Spot V2 открытый поток'),
      checkEndpoint('MEXC Open API', 'mexc', 'https://api.mexc.com/api/v3/ping', 'MEXC Spot тикеры альткоинов'),
      checkEndpoint('CoinGecko Free API', 'coingecko', 'https://api.coingecko.com/api/v3/ping', 'Каталог капитализации Топ-500 монет'),
      checkCmc(),
    ]);

    res.json({
      providers: [cmc, binance, bybit, okx, bitget, mexc, coingecko],
      systemTime: new Date().toISOString(),
    });
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
