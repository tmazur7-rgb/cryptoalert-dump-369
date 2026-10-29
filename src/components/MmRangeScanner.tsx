import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MmRangeCoin,
  MmScanFilterParams,
  TriggerRule,
  SupportedExchange,
} from '../types/crypto';
import {
  Repeat,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Send,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Sliders,
  CheckCircle2,
  Clock,
  BarChart3,
  Search,
} from 'lucide-react';

interface MmRangeScannerProps {
  rule: TriggerRule;
  onAddTrackedCoin: (coin: { id: string; symbol: string; name: string; priceUsd: number }) => void;
  trackedCoinSymbols: Set<string>;
}

export const MmRangeScanner: React.FC<MmRangeScannerProps> = ({
  rule,
  onAddTrackedCoin,
  trackedCoinSymbols,
}) => {
  const [coins, setCoins] = useState<MmRangeCoin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{ [symbol: string]: string }>({});

  // Filter params
  const [timeframe, setTimeframe] = useState<'24h' | '3d' | '7d'>('3d');
  const [minDrop, setMinDrop] = useState<number>(5);
  const [maxDrop, setMaxDrop] = useState<number>(20);
  const [minRebound, setMinRebound] = useState<number>(5);
  const [minCycles, setMinCycles] = useState<number>(2);
  const [onlyAtSupport, setOnlyAtSupport] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>('default');

  const fetchCycles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        timeframe,
        minDrop: String(minDrop),
        maxDrop: String(maxDrop),
        minRebound: String(minRebound),
        minCycles: String(minCycles),
        onlyAtSupport: onlyAtSupport ? 'true' : 'false',
      });
      const res = await fetch(`/api/crypto/mm-cycles?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.coins)) {
        setCoins(data.coins);
      } else {
        throw new Error(data.error || 'Не удалось получить данные циклов');
      }
    } catch (err: any) {
      console.error('Fetch MM cycles error:', err);
      setError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, minDrop, maxDrop, minRebound, minCycles, onlyAtSupport]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Presets
  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    if (presetName === 'classic') {
      // Classic MM Ping-Pong 5-15%
      setMinDrop(5);
      setMaxDrop(15);
      setMinRebound(5);
      setMinCycles(2);
      setOnlyAtSupport(false);
      setTimeframe('3d');
    } else if (presetName === 'wide') {
      // Wide Flat 10-20%
      setMinDrop(10);
      setMaxDrop(20);
      setMinRebound(10);
      setMinCycles(2);
      setOnlyAtSupport(false);
      setTimeframe('3d');
    } else if (presetName === 'frequent') {
      // Frequent cycles 3+
      setMinDrop(5);
      setMaxDrop(20);
      setMinRebound(5);
      setMinCycles(3);
      setOnlyAtSupport(false);
      setTimeframe('7d');
    } else if (presetName === 'buy_zone') {
      // Currently at support
      setMinDrop(5);
      setMaxDrop(20);
      setMinRebound(5);
      setMinCycles(2);
      setOnlyAtSupport(true);
      setTimeframe('3d');
    }
  };

  const handleSendTelegramAlert = async (coin: MmRangeCoin) => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      alert('Укажите Telegram Bot Token и Chat ID в разделе "Настройки триггеров"');
      return;
    }

    setTelegramStatus((prev) => ({ ...prev, [coin.symbol]: 'sending' }));
    try {
      const res = await fetch('/api/notify/mm-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: rule.telegramBotToken,
          chatId: rule.telegramChatId,
          coin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus((prev) => ({ ...prev, [coin.symbol]: 'success' }));
        setTimeout(() => {
          setTelegramStatus((prev) => {
            const next = { ...prev };
            delete next[coin.symbol];
            return next;
          });
        }, 4000);
      } else {
        alert(`Ошибка отправки: ${data.error}`);
        setTelegramStatus((prev) => ({ ...prev, [coin.symbol]: 'error' }));
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
      setTelegramStatus((prev) => ({ ...prev, [coin.symbol]: 'error' }));
    }
  };

  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return coins;
    const q = searchQuery.toLowerCase().trim();
    return coins.filter(
      (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [coins, searchQuery]);

  // Aggregate stats
  const supportCount = useMemo(() => coins.filter((c) => c.channelStatus === 'at_support').length, [coins]);
  const avgCycles = useMemo(() => {
    if (coins.length === 0) return 0;
    return Math.round((coins.reduce((s, c) => s + c.cycleCount, 0) / coins.length) * 10) / 10;
  }, [coins]);
  const avgRebound = useMemo(() => {
    if (coins.length === 0) return 0;
    return Math.round((coins.reduce((s, c) => s + c.avgReboundPercent, 0) / coins.length) * 10) / 10;
  }, [coins]);

  return (
    <div className="space-y-6">
      {/* Hero Explainer Banner */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              <Repeat className="w-3.5 h-3.5" />
              <span>Алгоритмический поиск флэта & ботов маркетмейкера</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Систематические циклы: падение 5–20% ➔ отскок 5–20%
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Сканер анализирует свечной график топ-активов на Binance и Bybit, выявляет монеты, зажатые в горизонтальном коридоре (боковике), где боты маркетмейкера систематически гоняют цену от поддержки к сопротивлению.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Найдено монет</div>
              <div className="text-lg font-bold text-white font-mono-numbers">{coins.length}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-emerald-400 font-medium">У дна (Buy Zone)</div>
              <div className="text-lg font-bold text-emerald-400 font-mono-numbers">{supportCount}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-indigo-400 font-medium">Ср. циклов</div>
              <div className="text-lg font-bold text-indigo-300 font-mono-numbers">{avgCycles}x</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Ср. отскок</div>
              <div className="text-lg font-bold text-cyan-300 font-mono-numbers">+{avgRebound}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Buttons & Quick Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Пресеты стратегии:
            </span>
            <button
              onClick={() => applyPreset('classic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                activePreset === 'classic'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              🔄 ММ Пинг-понг (5–15%)
            </button>
            <button
              onClick={() => applyPreset('wide')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                activePreset === 'wide'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              📏 Широкий флэт (10–20%)
            </button>
            <button
              onClick={() => applyPreset('frequent')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                activePreset === 'frequent'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              ⚡ Частые циклы (3+ повторений, 7д)
            </button>
            <button
              onClick={() => applyPreset('buy_zone')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                activePreset === 'buy_zone'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-900 text-emerald-400 border-emerald-900/60 hover:bg-slate-800'
              }`}
            >
              🎯 Сейчас у дна (Зона покупки)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск монеты..."
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-40 sm:w-48"
              />
            </div>
            <button
              onClick={fetchCycles}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Repeat className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Анализ...' : 'Обновить'}</span>
            </button>
          </div>
        </div>

        {/* Detailed Controls Drawer */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {/* Timeframe */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Период истории:
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setTimeframe('24h')}
                className={`py-1 rounded text-center font-medium ${timeframe === '24h' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                24 часа
              </button>
              <button
                onClick={() => setTimeframe('3d')}
                className={`py-1 rounded text-center font-medium ${timeframe === '3d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                3 дня
              </button>
              <button
                onClick={() => setTimeframe('7d')}
                className={`py-1 rounded text-center font-medium ${timeframe === '7d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                7 дней
              </button>
            </div>
          </div>

          {/* Drop Range */}
          <div>
            <div className="flex justify-between text-slate-400 font-medium mb-1.5">
              <span>Падение в цикле:</span>
              <span className="text-white font-mono-numbers">
                {minDrop}% – {maxDrop}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={minDrop}
                onChange={(e) => {
                  setMinDrop(Number(e.target.value));
                  setActivePreset('custom');
                }}
                className="w-full accent-rose-500"
              />
              <span className="text-slate-500 text-[10px]">до</span>
              <input
                type="range"
                min="10"
                max="25"
                step="1"
                value={maxDrop}
                onChange={(e) => {
                  setMaxDrop(Number(e.target.value));
                  setActivePreset('custom');
                }}
                className="w-full accent-rose-500"
              />
            </div>
          </div>

          {/* Min Rebound */}
          <div>
            <div className="flex justify-between text-slate-400 font-medium mb-1.5">
              <span>Мин. отскок:</span>
              <span className="text-emerald-400 font-mono-numbers">≥ {minRebound}%</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={minRebound}
              onChange={(e) => {
                setMinRebound(Number(e.target.value));
                setActivePreset('custom');
              }}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>+3%</span>
              <span>+10%</span>
              <span>+20%</span>
            </div>
          </div>

          {/* Min Cycles */}
          <div>
            <div className="flex justify-between text-slate-400 font-medium mb-1.5">
              <span>Мин. повторений:</span>
              <span className="text-indigo-300 font-mono-numbers">≥ {minCycles} раз(а)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => {
                    setMinCycles(cnt);
                    setActivePreset('custom');
                  }}
                  className={`py-1 rounded text-center font-medium ${minCycles === cnt ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {cnt}+
                </button>
              ))}
            </div>
          </div>

          {/* Checkbox: only near support */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={onlyAtSupport}
                onChange={(e) => {
                  setOnlyAtSupport(e.target.checked);
                  setActivePreset('custom');
                }}
                className="rounded accent-emerald-500 text-emerald-500 w-4 h-4"
              />
              <span className="text-xs font-medium text-slate-300 select-none">
                Только у дна канала (Зона покупки)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
          <Repeat className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-white">Сканирование свечных графиков на Binance & Bybit...</div>
          <div className="text-xs text-slate-400 mt-1">
            Поиск систематических циклов 5–20% падения и отскока среди 65 самых ликвидных пар
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCycles}
            className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-white rounded font-medium"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredCoins.length === 0 && (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-sm font-semibold text-white">Монет с заданными параметрами циклов не найдено</div>
          <div className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Попробуйте расширить диапазон или снизить минимальное число повторений циклов (например, до 1+ или 2+ циклов).
          </div>
          <button
            onClick={() => applyPreset('classic')}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
          >
            Сбросить к пресету «ММ Пинг-понг»
          </button>
        </div>
      )}

      {/* Coins List / Cards */}
      {!isLoading && !error && filteredCoins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Показано <b>{filteredCoins.length}</b> монет с систематическими циклами отскока
            </span>
            <span>Сортировка: по числу повторений и индексу флэта</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredCoins.map((coin) => {
              const isExpanded = expandedCoin === coin.symbol;
              const isTracked = trackedCoinSymbols.has(coin.symbol.toUpperCase());
              const tgState = telegramStatus[coin.symbol];

              return (
                <div
                  key={coin.symbol}
                  className={`rounded-xl border transition-all ${
                    coin.channelStatus === 'at_support'
                      ? 'border-emerald-500/40 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    {/* Top Row: Coin Info, Badges, Metrics */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Block: Symbol, Status, Price */}
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-sm shrink-0">
                          {coin.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white tracking-tight">
                              {coin.symbol}
                            </span>
                            <span className="text-xs text-slate-400">/ USDT</span>

                            {/* Cycle Count Badge */}
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono-numbers">
                              <Repeat className="w-3 h-3" />
                              {coin.cycleCount} {coin.cycleCount === 1 ? 'цикл' : coin.cycleCount < 5 ? 'цикла' : 'циклов'}
                            </span>

                            {/* Channel Status Badge */}
                            {coin.channelStatus === 'at_support' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                ЗОНА ПОКУПКИ (У ДНА КАНАЛА)
                              </span>
                            )}
                            {coin.channelStatus === 'at_resistance' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                У ВЕРХНЕЙ ГРАНИЦЫ
                              </span>
                            )}
                            {coin.channelStatus === 'mid_channel' && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                В середине флэта
                              </span>
                            )}

                            {/* Flatness Index */}
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-cyan-500/30"
                              title="Индекс ровности горизонтального канала. Выше 80% означает жесткий алгоритмический коридор ботов"
                            >
                              Индекс флэта: {coin.flatnessScore}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="text-white font-mono-numbers font-semibold">
                              ${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(4)}
                            </span>
                            <span
                              className={`font-mono-numbers font-medium ${
                                coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {coin.change24h >= 0 ? '+' : ''}
                              {coin.change24h.toFixed(2)}%
                            </span>
                            <span>• Объем: ${(coin.volume24h / 1_000_000).toFixed(1)}M</span>
                            <span className="text-slate-500">• {coin.exchange.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Stats Summary */}
                      <div className="flex items-center gap-4 text-xs font-mono-numbers bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                        <div>
                          <div className="text-[10px] text-slate-500">Ср. падение</div>
                          <div className="text-rose-400 font-bold">-{coin.avgDropPercent}%</div>
                        </div>
                        <div className="w-px h-6 bg-slate-800" />
                        <div>
                          <div className="text-[10px] text-slate-500">Ср. отскок</div>
                          <div className="text-emerald-400 font-bold">+{coin.avgReboundPercent}%</div>
                        </div>
                        <div className="w-px h-6 bg-slate-800" />
                        <div>
                          <div className="text-[10px] text-slate-500">Длительность</div>
                          <div className="text-slate-200 font-medium">{coin.avgCycleHours} ч</div>
                        </div>
                        <div className="w-px h-6 bg-slate-800" />
                        <div>
                          <div className="text-[10px] text-slate-500">Ширина флэта</div>
                          <div className="text-indigo-300 font-bold">{coin.channelWidthPercent}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Horizontal Corridor Visualizer */}
                    <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono-numbers">
                        <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <span>Поддержка (Дно):</span>
                          <span>${coin.channelLow < 0.01 ? coin.channelLow.toFixed(6) : coin.channelLow.toFixed(4)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({coin.distanceToSupportPercent}% от тек. цены)
                          </span>
                        </div>

                        <div className="text-slate-400 text-[11px] hidden sm:block">
                          {coin.currentSwing === 'bouncing' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                              <TrendingUp className="w-3.5 h-3.5" />
                              Отскок вверх от поддержки начался
                            </span>
                          ) : coin.currentSwing === 'dropping' ? (
                            <span className="text-rose-400 flex items-center gap-1 font-semibold">
                              <TrendingDown className="w-3.5 h-3.5" />
                              Идет коррекция к поддержке
                            </span>
                          ) : (
                            <span>Горизонтальная консолидация</span>
                          )}
                        </div>

                        <div className="text-rose-400 flex items-center gap-1 font-semibold">
                          <span>Сопротивление:</span>
                          <span>${coin.channelHigh < 0.01 ? coin.channelHigh.toFixed(6) : coin.channelHigh.toFixed(4)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            (+{coin.distanceToResistancePercent}% ход)
                          </span>
                        </div>
                      </div>

                      {/* Visual Channel Track */}
                      <div className="relative h-6 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center px-1">
                        {/* Support Zone Marker (0-25%) */}
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-emerald-500/15 border-r border-emerald-500/30"
                          style={{ width: '25%' }}
                        />
                        {/* Resistance Zone Marker (75-100%) */}
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-rose-500/15 border-l border-rose-500/30"
                          style={{ width: '25%' }}
                        />

                        {/* Current Position Marker */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center -ml-2.5 transition-all duration-300 z-10"
                          style={{ left: `${Math.max(2, Math.min(98, coin.currentChannelPositionPercent))}%` }}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-lg ${
                              coin.channelStatus === 'at_support'
                                ? 'bg-emerald-500 border-white text-slate-950'
                                : coin.channelStatus === 'at_resistance'
                                ? 'bg-rose-500 border-white text-white'
                                : 'bg-indigo-500 border-white text-white'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>0% (Нижняя граница)</span>
                        <span className="text-slate-400">
                          Текущее положение: <b>{coin.currentChannelPositionPercent}%</b> коридора
                        </span>
                        <span>100% (Верхняя граница)</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* Expand Cycles Button */}
                        <button
                          onClick={() => setExpandedCoin(isExpanded ? null : coin.symbol)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Activity className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isExpanded ? 'Скрыть историю циклов' : `История ${coin.cycles.length} циклов`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Send Telegram Alert */}
                        <button
                          onClick={() => handleSendTelegramAlert(coin)}
                          disabled={tgState === 'sending'}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                            tgState === 'success'
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : tgState === 'error'
                              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                              : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/50'
                          }`}
                          title="Отправить готовый сигнал по флэту этой монеты в Telegram"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {tgState === 'sending'
                              ? 'Отправка...'
                              : tgState === 'success'
                              ? 'Сигнал в TG отправлен!'
                              : 'Сигнал в Telegram'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Track in Basket */}
                        <button
                          onClick={() =>
                            onAddTrackedCoin({
                              id: coin.symbol,
                              symbol: coin.symbol,
                              name: coin.name,
                              priceUsd: coin.priceUsd,
                            })
                          }
                          disabled={isTracked}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                            isTracked
                              ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isTracked ? 'В корзине отслеживания' : '+ В отслеживаемые'}</span>
                        </button>

                        {/* TradingView Chart */}
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=BINANCE:${coin.symbol}USDT`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors flex items-center gap-1"
                          title="Открыть живой график на TradingView"
                        >
                          <span>График</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Expanded Cycles History Table */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-indigo-400" />
                          <span>Зафиксированные повторения (Падение ➔ Отскок) за выбранный период:</span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80">
                          <table className="w-full text-xs text-left">
                            <thead className="text-[10px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
                              <tr>
                                <th className="px-3 py-2">№ Цикла</th>
                                <th className="px-3 py-2 text-rose-400">1. Падение (Дроп)</th>
                                <th className="px-3 py-2 text-emerald-400">2. Отскок (Rebound)</th>
                                <th className="px-3 py-2">Цена дна</th>
                                <th className="px-3 py-2">Цена пика</th>
                                <th className="px-3 py-2">Длительность</th>
                                <th className="px-3 py-2">Время дна</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono-numbers">
                              {coin.cycles.map((cyc, idx) => (
                                <tr key={cyc.id} className="hover:bg-slate-900/40">
                                  <td className="px-3 py-2 font-bold text-indigo-300">#{idx + 1}</td>
                                  <td className="px-3 py-2 text-rose-400 font-bold">-{cyc.dropPercent}%</td>
                                  <td className="px-3 py-2 text-emerald-400 font-bold">+{cyc.reboundPercent}%</td>
                                  <td className="px-3 py-2 text-slate-300">${cyc.troughPrice.toFixed(4)}</td>
                                  <td className="px-3 py-2 text-slate-300">${cyc.reboundPeakPrice.toFixed(4)}</td>
                                  <td className="px-3 py-2 text-slate-400">{cyc.cycleDurationHours} ч</td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {new Date(cyc.troughTimestamp).toLocaleString('ru-RU', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
