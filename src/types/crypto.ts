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

  // TokenInsight.com Free/Pro API Key (TI_API_KEY)
  tokenInsightApiKey?: string;
  useTokenInsight?: boolean;
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

export interface TokenInsightKeyStatus {
  valid: boolean;
  planName?: string;
  rateLimitMinute?: number;
  creditsLeft?: number;
  creditsUsed?: number;
  error?: string;
  checkedAt?: string;
}

export interface TokenInsightCoin {
  id: string;
  name: string;
  symbol: string;
  logoUrl?: string;
  priceUsd: number;
  change24h: number;
  change1h?: number;
  marketCap?: number;
  volume24h?: number;
  rating?: string;
  rank?: number;
  tid?: string;
  category?: string;
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
  exchangeId?: SupportedExchange | 'coingecko' | 'coincap' | 'coinmarketcap' | 'tokeninsight';
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

export interface MmCycle {
  id: string;
  dropPercent: number; // e.g. 12.4 (%)
  reboundPercent: number; // e.g. 14.2 (%)
  peakPrice: number;
  troughPrice: number;
  reboundPeakPrice: number;
  troughTimestamp: number;
  cycleDurationHours: number; // e.g. 6.5
}

export type MmChannelPosition = 'at_support' | 'mid_channel' | 'at_resistance';

export interface MmRangeCoin {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  channelLow: number; // Support
  channelHigh: number; // Resistance
  channelWidthPercent: number; // (High - Low) / Low * 100
  currentChannelPositionPercent: number; // 0% (at support) to 100% (at resistance)
  channelStatus: MmChannelPosition;
  cycleCount: number; // number of systematic 5-20% drop+rebound cycles
  avgDropPercent: number;
  avgReboundPercent: number;
  avgCycleHours: number;
  flatnessScore: number; // 0-100% consistency of channel bounds
  currentSwing: 'dropping' | 'bouncing' | 'neutral';
  distanceToSupportPercent: number; // % from current price to support
  distanceToResistancePercent: number; // % from current price to resistance
  cycles: MmCycle[];
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  sparkline: number[];
  exchange: SupportedExchange;
  logoUrl?: string;
}

export interface MmScanFilterParams {
  timeframe: '24h' | '3d' | '7d';
  minDrop: number; // e.g. 5
  maxDrop: number; // e.g. 20
  minRebound: number; // e.g. 5
  maxRebound: number; // e.g. 25
  minCycles: number; // e.g. 2, 3, 4
  onlyAtSupport?: boolean; // filter only coins currently near the bottom (buy zone)
  minVolumeUsd?: number;
}

export type FundTier = 'tier1' | 'tier2';

export interface CryptoFund {
  id: string; // e.g. 'circle-ventures', 'coinbase-ventures', 'binance-labs'
  name: string; // e.g. 'Circle Ventures', 'Coinbase Ventures', 'YZi Labs (Prev. Binance Labs)'
  shortName: string;
  tier: FundTier;
  category: string;
  description: string;
  website?: string;
  aum?: string;
  color: string;
}

export interface FundInvestmentCoin {
  symbol: string;
  name: string;
  category: 'L1/L2' | 'DeFi' | 'AI & Data' | 'Infrastructure' | 'DePIN' | 'Gaming/NFT' | 'Interop';
  description: string;
  funds: string[]; // array of fund IDs
  leadFunds?: string[];
  rounds?: string[];
  coingeckoId: string;
  // Live merged market metrics
  priceUsd?: number;
  change24h?: number;
  change1h?: number;
  volume24h?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  rank?: number;
}

export interface FundPortfolioItem {
  coinSymbol: string;
  weightPercent: number;
  allocationUsd: number;
  tokenAmount: number;
}

// ==========================================
// ACCUMULATION PHASE OF CRYPTOCURRENCIES
// ==========================================
export type WyckoffPhase =
  | 'Phase A (Stopping)'
  | 'Phase B (Absorption)'
  | 'Phase C (Spring/Test)'
  | 'Phase D (SOS Breakout)';

export type DominantActor = 'whale' | 'bots' | 'hybrid';

export interface AccumulationCoin {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  change1h?: number;
  change7d?: number;
  volume24h: number;
  marketCap?: number;
  volumeSurgeRatio: number; // e.g. 2.4x (240% of normal baseline)
  accumulationScore: number; // 0 - 100
  rangeLow: number; // Support floor of accumulation box
  rangeHigh: number; // Resistance ceiling of accumulation box
  rangeWidthPercent: number; // e.g. 7.5%
  daysInAccumulation: number; // e.g. 18 days
  currentPositionPercent: number; // 0% (at support/spring) to 100% (at resistance)
  failedBreakouts: number; // Count of failed breaks above range
  failedBreakdowns: number; // Count of failed breaks below range (springs / liquidity sweeps)
  dominantActor: DominantActor;
  dominantActorLabel: string; // 'Крупный кит (Whale)', 'Алгоритмические боты (Bots)', 'Смарт-мани (Hybrid)'
  wyckoffPhase: WyckoffPhase;
  targetBreakoutUsd: number; // Projected breakout target
  potentialUpsidePercent: number; // e.g. +38%
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
  analysisSummary: string;
  sparkline: number[];
  candles?: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  exchange: SupportedExchange;
  logoUrl?: string;
}

export interface AccumulationFilterParams {
  minScore: number; // e.g. 60
  actor: 'all' | 'whale' | 'bots' | 'hybrid';
  wyckoffPhase: 'all' | 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D';
  minVolumeSurge: number; // e.g. 1.3
  maxRangeWidth: number; // e.g. 18
  searchQuery?: string;
}
