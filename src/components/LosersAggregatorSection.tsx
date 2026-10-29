import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Flame,
  TrendingDown,
  RefreshCw,
  Target,
  Send,
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Search,
} from 'lucide-react';
import { TriggerRule, TokenInsightCoin, CryptoCoin } from '../types/crypto';

interface LosersAggregatorSectionProps {
  rule: TriggerRule;
  onAddTrackedCoin: (coin: { id: string; symbol: string; name: string; priceUsd: number }) => void;
  onOpenSettings?: () => void;
  trackedCoinsSymbols: Set<string>;
}

// 7 Reference monitoring platforms specified by the user
const MONITORING_AGGREGATORS = [
  {
    name: 'CoinGecko 1H',
    label: 'Losers 1H',
    url: 'https://www.coingecko.com/en/crypto-gainers-losers?time=h1&top=100',
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/30',
    badge: '1 Час',
  },
  {
    name: 'CoinGecko 24H',
    label: 'Losers 24H',
    url: 'https://www.coingecko.com/en/crypto-gainers-losers?time=h24&top=100',
    color: 'border-emerald-500/30 text-emerald-300 bg-emerald-950/20 hover:bg-emerald-900/30',
    badge: '24 Часа',
  },
  {
    name: 'CryptoRank',
    label: 'CryptoRank Losers',
    url: 'https://cryptorank.io/losers',
    color: 'border-blue-500/30 text-blue-400 bg-blue-950/20 hover:bg-blue-900/30',
    badge: 'Top Losers',
  },
  {
    name: 'CoinMarketCap',
    label: 'CMC Losers',
    url: 'https://coinmarketcap.com/gainers-losers/',
    color: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20 hover:bg-cyan-900/30',
    badge: 'Gainers & Losers',
  },
  {
    name: 'CoinCodex',
    label: 'CoinCodex Losers',
    url: 'https://coincodex.com/gainers-losers/',
    color: 'border-purple-500/30 text-purple-400 bg-purple-950/20 hover:bg-purple-900/30',
    badge: 'Live Dumps',
  },
  {
    name: 'Coinglass',
    label: 'Coinglass Losers',
    url: 'https://www.coinglass.com/gainers-losers',
    color: 'border-amber-500/30 text-amber-400 bg-amber-950/20 hover:bg-amber-900/30',
    badge: 'Derivatives & Spot',
  },
  {
    name: 'TokenInsight',
    label: 'TokenInsight Losers',
    url: 'https://tokeninsight.com/en/cryptocurrencies/gainers-losers',
    color: 'border-rose-500/30 text-rose-400 bg-rose-950/20 hover:bg-rose-900/30',
    badge: 'API Connected',
  },
];

export const LosersAggregatorSection: React.FC<LosersAggregatorSectionProps> = ({
  rule,
  onAddTrackedCoin,
  onOpenSettings,
  trackedCoinsSymbols,
}) => {
  const [tiCoins, setTiCoins] = useState<TokenInsightCoin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [keyConfigured, setKeyConfigured] = useState<boolean>(false);
  const [sourceLabel, setSourceLabel] = useState<string>('TokenInsight API');
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterMode, setFilterMode] = useState<'all' | '5-20' | 'severe'>('5-20');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sendingSymbol, setSendingSymbol] = useState<string | null>(null);
  const [sendSuccessSymbol, setSendSuccessSymbol] = useState<string | null>(null);

  const fetchTiLosers = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = rule.tokenInsightApiKey?.trim() || '';
      const query = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';
      const res = await fetch(`/api/crypto/tokeninsight/losers${query}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.coins)) {
        setTiCoins(data.coins);
        setKeyConfigured(Boolean(data.keyConfigured));
        setSourceLabel(data.source || 'TokenInsight Official API');
      } else {
        throw new Error(data.error || 'Ошибка загрузки данных из TokenInsight');
      }
    } catch (err: any) {
      console.error('Failed to fetch TokenInsight losers:', err);
      setError(err.message || 'Ошибка подключения к TokenInsight API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiLosers();
  }, [rule.tokenInsightApiKey]);

  // Filtered list
  const displayedCoins = tiCoins.filter((c) => {
    const dropMag = Math.abs(c.change24h);
    if (filterMode === '5-20') {
      if (dropMag < 5 || dropMag > 20) return false;
    } else if (filterMode === 'severe') {
      if (dropMag <= 20) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSendTelegramAlert = async (c: TokenInsightCoin) => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      alert('Сначала укажите Telegram Bot Token и Chat ID в Настройках триггеров.');
      return;
    }

    setSendingSymbol(c.symbol);
    try {
      const res = await fetch('/api/notify/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: rule.telegramBotToken,
          chatId: rule.telegramChatId,
          symbol: c.symbol,
          name: c.name,
          dropPercent: c.change24h,
          currentPrice: c.priceUsd,
          timeFrame: '24 часа (TokenInsight Losers)',
          exchange: 'TokenInsight API',
          thresholdTriggered: `${Math.abs(c.change24h).toFixed(1)}% просадка`,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSendSuccessSymbol(c.symbol);
        setTimeout(() => setSendSuccessSymbol(null), 3000);
      } else {
        alert(`Ошибка отправки: ${json.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setSendingSymbol(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
      {/* Header with Title and External Aggregator Links */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-rose-500/20 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Losers 24H &amp; Агрегаторы падения криптовалют
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Прямое извлечение через <b>TokenInsight API</b> и моментальный доступ к 7 ведущим платформам мониторинга просадок:
          </p>
        </div>

        {/* API Key Status Pill & Refresh */}
        <div className="flex items-center gap-2">
          {keyConfigured ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>TI_API_KEY подключен</span>
            </span>
          ) : (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-950/50 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Ввести TI_API_KEY</span>
            </button>
          )}

          <button
            onClick={fetchTiLosers}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors disabled:opacity-50"
            title="Обновить список Losers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 7 Quick Links to user's favorite aggregator pages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MONITORING_AGGREGATORS.map((agg, idx) => (
          <a
            key={idx}
            href={agg.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2 rounded-lg border text-xs font-semibold flex flex-col justify-between transition-all group ${agg.color}`}
          >
            <div className="flex items-center justify-between text-[10px] opacity-75 font-mono-numbers">
              <span>{agg.badge}</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div className="font-bold text-white text-xs mt-1 truncate">
              {agg.name}
            </div>
          </a>
        ))}
      </div>

      {/* Filter and Search Bar for TokenInsight Losers */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 mr-1 font-medium">Фильтр просадки:</span>
          <button
            onClick={() => setFilterMode('5-20')}
            className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
              filterMode === '5-20'
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🎯 Падение 5–20% (Целевой)
          </button>
          <button
            onClick={() => setFilterMode('severe')}
            className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
              filterMode === 'severe'
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            💥 Глубокий дамп (&gt; 20%)
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Все ({tiCoins.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по тикеру..."
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-500 w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* TokenInsight Losers 24H Grid / Cards */}
      {loading && tiCoins.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-rose-400 mx-auto mb-2" />
          <div className="text-xs">Загрузка монет Losers 24H из TokenInsight...</div>
        </div>
      ) : error && tiCoins.length === 0 ? (
        <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchTiLosers}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px]"
          >
            Повторить
          </button>
        </div>
      ) : displayedCoins.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs">
          Монет с заданным порогом просадки в текущей выгрузке не обнаружено.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {displayedCoins.slice(0, 15).map((coin) => {
            const isTracked = trackedCoinsSymbols.has(coin.symbol.toUpperCase());
            const priceFmt =
              coin.priceUsd < 0.01
                ? coin.priceUsd.toFixed(6)
                : coin.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

            return (
              <div
                key={coin.symbol}
                className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="truncate">
                      <div className="font-bold text-white text-sm font-mono-numbers flex items-center gap-1.5">
                        <span>#{coin.symbol}</span>
                        {coin.rating && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {coin.rating}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[110px]">
                        {coin.name}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono-numbers text-rose-400 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-500/30">
                        {coin.change24h > 0 ? `+${coin.change24h}%` : `${coin.change24h}%`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-baseline justify-between text-xs">
                    <span className="font-bold text-white font-mono-numbers">${priceFmt}</span>
                    {coin.volume24h && coin.volume24h > 0 ? (
                      <span className="text-[10px] text-slate-500 font-mono-numbers">
                        ${(coin.volume24h / 1000000).toFixed(1)}M
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  <button
                    onClick={() =>
                      onAddTrackedCoin({
                        id: coin.symbol,
                        symbol: coin.symbol,
                        name: coin.name,
                        priceUsd: coin.priceUsd,
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                      isTracked
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isTracked ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>В корзине</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-3 h-3 text-amber-400" />
                        <span>В корзину</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSendTelegramAlert(coin)}
                      disabled={sendingSymbol === coin.symbol}
                      className="p-1 text-slate-400 hover:text-sky-300 hover:bg-sky-950/40 rounded transition-colors"
                      title="Отправить алерт в Telegram"
                    >
                      <Send
                        className={`w-3 h-3 ${
                          sendingSymbol === coin.symbol ? 'animate-pulse text-sky-400' : ''
                        }`}
                      />
                    </button>

                    <a
                      href={`https://tokeninsight.com/en/coins/${encodeURIComponent(coin.id || coin.symbol.toLowerCase())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Открыть профиль на TokenInsight"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
