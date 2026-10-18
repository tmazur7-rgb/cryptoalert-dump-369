export type SupportedExchange = 'binance' | 'bybit' | 'okx' | 'bitget' | 'mexc';

export interface ExchangeQuote {
  exchange: SupportedExchange;
  exchangeName: string;
  price: number;
  change24h: number;
  change1h?: number;
  volume24h: number;
}

export interface CryptoCoin {
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
  exchangeQuotes?: Record<SupportedExchange, ExchangeQuote>;
}

export interface DropTrendCoin {
  coin: CryptoCoin;
  drop1h: number; // e.g. -4.8%
  drop24h: number; // e.g. -6.2%
  accelerationMultiplier: number; // e.g. 5.6x faster than normal 24h hourly pace
  hourlySharePercent: number; // e.g. 77% of total 24h drop happened in the last hour
  intensity: 'critical' | 'high' | 'moderate';
  heuristicReason: string;
}

export type DropPreset =
  | '5-20'
  | '10-20'
  | 'exact-5'
  | 'exact-10'
  | 'exact-15'
  | 'exact-20'
  | 'all'
  | 'custom';

export type ScopePreset = 50 | 100 | 250 | 500;

export type SoundType = 'chime' | 'pulse' | 'sonar' | 'none';

export interface TrackedCoinConfig {
  id: string;
  symbol: string;
  name: string;
  targetDropPercent: number; // e.g. 5, 10, 15, 20
  customThresholdEnabled?: boolean;
  logoUrl?: string;
}

export interface TriggerRule {
  minDrop: number; // e.g. 5, 10
  maxDrop: number; // e.g. 20 (or 100)
  dropMode: 'exact' | 'range'; // 'exact' means drop >= exactDropPercent, 'range' means between minDrop and maxDrop
  exactDropPercent: number; // e.g. 5, 10, 15, 20
  timeframe: '1h' | '24h' | '7d'; // timeframe for drop calculation (1 hour or 24 hours)
  minVolumeUsd: number; // e.g. 100000
  scope: ScopePreset;
  soundEnabled: boolean;
  soundType: SoundType;
  browserNotifyEnabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  autoScanIntervalSeconds: number; // e.g. 30, 60, 3600 (every hour)

  // Hourly digest notification toggle
  hourlyDigestEnabled: boolean;
  lastHourlyDigestTimestamp?: number;

  // Multi-exchange settings
  selectedExchanges: SupportedExchange[];
  exchangeAggregationMode: 'any' | 'average' | 'first';

  // Manual list of up to 10 coins from Top 500
  trackedCoins: TrackedCoinConfig[];
  onlyTrackedCoins: boolean;

  // CoinMarketCap Free API Key configuration
  cmcApiKey?: string;
  useCmcCatalog?: boolean;
}

export interface CmcKeyStatus {
  valid: boolean;
  planName?: string;
  creditsUsedMonth?: number;
  creditsLeftMonth?: number;
  creditsUsedDay?: number;
  creditsLeftDay?: number;
  creditLimitMonthly?: number;
  rateLimitMinute?: number;
  error?: string;
  checkedAt?: string;
}

export interface TriggeredAlert {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  dropPercent: number;
  price: number;
  timestamp: number;
  source: string;
  timeframe: string; // e.g. '1ч' or '24ч'
  read: boolean;
  thresholdTriggered?: string;
}

export interface ProviderHealth {
  name: string;
  exchangeId?: SupportedExchange | 'coingecko' | 'coincap' | 'coinmarketcap';
  online: boolean;
  status: number;
  latencyMs: number;
  free: boolean;
  authRequired: boolean;
  note: string;
  error?: string;
  keyConfigured?: boolean;
  creditsLeft?: number;
}
