import React, { useState, useEffect, useMemo } from 'react';
import {
  AccumulationCoin,
  AccumulationFilterParams,
  TriggerRule,
  DominantActor,
} from '../types/crypto';
import {
  Boxes,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Search,
  RefreshCw,
  Send,
  ExternalLink,
  Target,
  Bot,
  Copy,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Clock,
  Zap,
} from 'lucide-react';

interface AccumulationPhaseScannerProps {
  rule: TriggerRule;
  onAddTrackedCoin: (coin: { id: string; symbol: string; name: string; priceUsd: number }) => void;
  trackedCoinSymbols: Set<string>;
}

export const AccumulationPhaseScanner: React.FC<AccumulationPhaseScannerProps> = ({
  rule,
  onAddTrackedCoin,
  trackedCoinSymbols,
}) => {
  const [coins, setCoins] = useState<AccumulationCoin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [actorFilter, setActorFilter] = useState<'all' | DominantActor>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D'>('all');
  const [minVolumeSurge, setMinVolumeSurge] = useState<number>(1.2);
  const [maxRangeWidth, setMaxRangeWidth] = useState<number>(24);
  const [minScore, setMinScore] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'surge' | 'range' | 'upside' | 'days'>('score');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // UI state
  const [sendingTelegramSymbol, setSendingTelegramSymbol] = useState<string | null>(null);
  const [telegramSuccessSymbol, setTelegramSuccessSymbol] = useState<string | null>(null);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const [selectedCoinModal, setSelectedCoinModal] = useState<AccumulationCoin | null>(null);

  // Fetch accumulation coins from API
  const fetchAccumulationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/crypto/accumulation-phase?minScore=50&minVolumeSurge=1.1&maxRangeWidth=28&actor=all&wyckoffPhase=all`
      );
      if (!res.ok) {
        throw new Error(`Ошибка сервера (${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.coins)) {
        setCoins(data.coins);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Не удалось получить данные аккумуляции');
      }
    } catch (err: any) {
      console.error('Failed to fetch accumulation phase:', err);
      setError(err.message || 'Ошибка загрузки сканера аккумуляции');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccumulationData();
  }, []);

  // Filter and sort coins
  const filteredCoins = useMemo(() => {
    return coins
      .filter((c) => {
        if (c.accumulationScore < minScore) return false;
        if (c.volumeSurgeRatio < minVolumeSurge) return false;
        if (c.rangeWidthPercent > maxRangeWidth) return false;

        if (actorFilter !== 'all' && c.dominantActor !== actorFilter) {
          return false;
        }

        if (phaseFilter !== 'all' && !c.wyckoffPhase.toLowerCase().includes(phaseFilter.toLowerCase())) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchSym = c.symbol.toLowerCase().includes(q);
          const matchName = c.name.toLowerCase().includes(q);
          const matchDesc = c.analysisSummary.toLowerCase().includes(q);
          if (!matchSym && !matchName && !matchDesc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.accumulationScore - a.accumulationScore;
        if (sortBy === 'surge') return b.volumeSurgeRatio - a.volumeSurgeRatio;
        if (sortBy === 'range') return a.rangeWidthPercent - b.rangeWidthPercent; // tighter first
        if (sortBy === 'upside') return b.potentialUpsidePercent - a.potentialUpsidePercent;
        if (sortBy === 'days') return b.daysInAccumulation - a.daysInAccumulation;
        return 0;
      });
  }, [coins, minScore, minVolumeSurge, maxRangeWidth, actorFilter, phaseFilter, searchQuery, sortBy]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = coins.length;
    const whales = coins.filter((c) => c.dominantActor === 'whale').length;
    const bots = coins.filter((c) => c.dominantActor === 'bots').length;
    const avgSurge = total > 0 ? coins.reduce((s, c) => s + c.volumeSurgeRatio, 0) / total : 0;
    const avgRange = total > 0 ? coins.reduce((s, c) => s + c.rangeWidthPercent, 0) / total : 0;
    const phaseCSprings = coins.filter((c) => c.wyckoffPhase.includes('Phase C')).length;

    return {
      total,
      whales,
      bots,
      avgSurge: Math.round(avgSurge * 10) / 10,
      avgRange: Math.round(avgRange * 10) / 10,
      phaseCSprings,
    };
  }, [coins]);

  // Copy analysis to clipboard
  const handleCopyAnalysis = (c: AccumulationCoin) => {
    const priceFmt = c.priceUsd < 0.01 ? c.priceUsd.toFixed(6) : c.priceUsd.toFixed(4);
    const lowFmt = c.rangeLow < 0.01 ? c.rangeLow.toFixed(6) : c.rangeLow.toFixed(4);
    const highFmt = c.rangeHigh < 0.01 ? c.rangeHigh.toFixed(6) : c.rangeHigh.toFixed(4);
    const targetFmt = c.targetBreakoutUsd < 0.01 ? c.targetBreakoutUsd.toFixed(6) : c.targetBreakoutUsd.toFixed(4);

    const text =
      `🐋 ФАЗА АККУМУЛЯЦИИ: ${c.symbol} (${c.name})\n` +
      `💵 Текущая цена: $${priceFmt}\n` +
      `🏆 Индекс аккумуляции: ${c.accumulationScore}/100\n` +
      `📊 Фаза Wyckoff: ${c.wyckoffPhase}\n` +
      `📈 Всплеск объема: ${c.volumeSurgeRatio}x выше нормы\n` +
      `👤 Действующее лицо: ${c.dominantActorLabel}\n` +
      `🧱 Коридор накопления: $${lowFmt} – $${highFmt} (${c.rangeWidthPercent}%)\n` +
      `⏳ Дней в диапазоне: ~${c.daysInAccumulation} дн.\n` +
      `⚠️ Ложные пробои: Вниз: ${c.failedBreakdowns} | Вверх: ${c.failedBreakouts}\n` +
      `🎯 Цель пробоя: $${targetFmt} (+${c.potentialUpsidePercent}%)\n` +
      `📝 ${c.analysisSummary}\n`;

    navigator.clipboard.writeText(text);
    setCopiedSymbol(c.symbol);
    setTimeout(() => setCopiedSymbol(null), 3000);
  };

  // Send Accumulation Alert to Telegram
  const handleSendTelegram = async (coin: AccumulationCoin) => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      alert('Сначала укажите Telegram Bot Token и Chat ID в разделе «Настройки триггеров».');
      return;
    }

    setSendingTelegramSymbol(coin.symbol);
    try {
      const res = await fetch('/api/notify/accumulation-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: rule.telegramBotToken,
          chatId: rule.telegramChatId,
          coin,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setTelegramSuccessSymbol(coin.symbol);
        setTimeout(() => setTelegramSuccessSymbol(null), 4000);
      } else {
        alert(`Ошибка отправки в Telegram: ${json.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setSendingTelegramSymbol(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero / Information Header */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Boxes className="w-3.5 h-3.5" />
              <span>Smart Money &amp; Volume Footprint Scanner</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Accumulation Phase of Cryptocurrencies
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              Below are the assets that are currently in the accumulation zone, which is signalled by the individual assets&apos;s performance and key metrics. During the accumulation phase, trading volumes are significantly higher than usual. The price fluctuates within a range for extended periods, delivering failed breaks in both directions, which makes it harder to analyse future price moves. This may also be caused by the activity of trading bots, or represent the appearance of a bigger player building up his position.
            </p>
            <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Алгоритмический поиск поглощения объемов крупными игроками и ботами маркетмейкера во флэте
              </span>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">В зоне накопления</div>
              <div className="text-lg font-bold text-white font-mono-numbers">
                {isLoading ? '...' : stats.total}
              </div>
              <div className="text-[10px] text-emerald-400">активов</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Следы кита (Whale)</div>
              <div className="text-lg font-bold text-emerald-400 font-mono-numbers">
                {isLoading ? '...' : stats.whales}
              </div>
              <div className="text-[10px] text-slate-400">ботов: {stats.bots}</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Ср. всплеск объема</div>
              <div className="text-lg font-bold text-amber-300 font-mono-numbers">
                {isLoading ? '...' : `${stats.avgSurge}x`}
              </div>
              <div className="text-[10px] text-slate-400">выше базиса</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Phase C (Spring)</div>
              <div className="text-lg font-bold text-indigo-400 font-mono-numbers">
                {isLoading ? '...' : stats.phaseCSprings}
              </div>
              <div className="text-[10px] text-indigo-300/80">тест дна</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
        {/* Top Control Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Actor Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Действующее лицо:
            </span>
            <button
              onClick={() => setActorFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                actorFilter === 'all'
                  ? 'bg-slate-800 border-slate-600 text-white font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Все игроки ({coins.length})
            </button>
            <button
              onClick={() => setActorFilter('whale')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                actorFilter === 'whale'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 font-semibold shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>🐋 Крупный кит (Whale)</span>
              <span className="text-[10px] opacity-75 font-mono-numbers">({stats.whales})</span>
            </button>
            <button
              onClick={() => setActorFilter('bots')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                actorFilter === 'bots'
                  ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200 font-semibold shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Bot className="w-3 h-3" />
              <span>Торговые боты (Grid)</span>
              <span className="text-[10px] opacity-75 font-mono-numbers">({stats.bots})</span>
            </button>
            <button
              onClick={() => setActorFilter('hybrid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                actorFilter === 'hybrid'
                  ? 'bg-slate-800 border-slate-600 text-white font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Смарт-мани (Hybrid)
            </button>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по тикеру..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Вид карточками"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Вид таблицей"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={fetchAccumulationData}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 disabled:opacity-50"
              title="Обновить сканер аккумуляции"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Wyckoff Phases & Sorting */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Фаза Wyckoff:</span>
            {(['all', 'Phase B', 'Phase C', 'Phase D'] as const).map((phase) => (
              <button
                key={phase}
                onClick={() => setPhaseFilter(phase)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  phaseFilter === phase
                    ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
              >
                {phase === 'all'
                  ? 'Все фазы'
                  : phase === 'Phase B'
                  ? 'Phase B (Набор)'
                  : phase === 'Phase C'
                  ? '⭐ Phase C (Spring / Тест)'
                  : '🚀 Phase D (Предпробой)'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            {/* Volume Surge quick selector */}
            <div className="flex items-center gap-1.5">
              <span>Объем:</span>
              <select
                value={minVolumeSurge}
                onChange={(e) => setMinVolumeSurge(parseFloat(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              >
                <option value={1.1}>Все всплески (&gt;1.1x)</option>
                <option value={1.5}>Выше нормы (&gt;1.5x)</option>
                <option value={2.0}>Значительный (&gt;2.0x)</option>
                <option value={3.0}>Аномальный (&gt;3.0x)</option>
              </select>
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5">
              <span>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              >
                <option value="score">По силе аккумуляции (Score)</option>
                <option value="surge">По всплеску объема (Volume Surge)</option>
                <option value="range">По узости диапазона (Плотный флэт)</option>
                <option value="upside">По потенциалу выхода (+%)</option>
                <option value="days">По длительности (Дни)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && coins.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
          <div className="text-white font-medium text-base">
            Сканирование зоны аккумуляции по 70+ ликвидным монетам...
          </div>
          <div className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Анализируются всплески торгового объема, серия ложных выносов в обе стороны, границы флэта и следы набора позиций китами.
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-rose-800/40 bg-rose-950/20 text-rose-300 space-y-3">
          <div className="font-semibold">{error}</div>
          <button
            onClick={fetchAccumulationData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium"
          >
            Повторить попытку
          </button>
        </div>
      ) : filteredCoins.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400">
          <Boxes className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-white font-semibold">Монет по заданным критериям не найдено</div>
          <div className="text-xs text-slate-400 mt-1">
            Попробуйте снизить минимальный порог объема или выбрать «Все игроки».
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoins.map((coin) => {
            const isTracked = trackedCoinSymbols.has(coin.symbol.toUpperCase());
            const priceFmt = coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(4);
            const lowFmt = coin.rangeLow < 0.01 ? coin.rangeLow.toFixed(6) : coin.rangeLow.toFixed(4);
            const highFmt = coin.rangeHigh < 0.01 ? coin.rangeHigh.toFixed(6) : coin.rangeHigh.toFixed(4);
            const targetFmt = coin.targetBreakoutUsd < 0.01 ? coin.targetBreakoutUsd.toFixed(6) : coin.targetBreakoutUsd.toFixed(4);

            return (
              <div
                key={coin.symbol}
                className="rounded-xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all p-5 flex flex-col justify-between space-y-4 relative overflow-hidden group"
              >
                {/* Top Badge & Score */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base tracking-tight font-mono-numbers">
                          #{coin.symbol}
                        </span>
                        <span className="text-xs text-slate-400 truncate max-w-[130px]">
                          {coin.name}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-white font-mono-numbers mt-0.5">
                        ${priceFmt}
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {coin.change24h >= 0 ? `+${coin.change24h}%` : `${coin.change24h}%`}
                        </span>
                      </div>
                    </div>

                    {/* Accumulation Score Badge */}
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono-numbers text-xs font-bold">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>{coin.accumulationScore}/100</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">сила накопления</div>
                    </div>
                  </div>

                  {/* Actor & Wyckoff Phase Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
                        coin.dominantActor === 'whale'
                          ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                          : coin.dominantActor === 'bots'
                          ? 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {coin.dominantActor === 'whale' ? '🐋 Кит (Whale)' : coin.dominantActor === 'bots' ? '🤖 Боты (Grid)' : '⚖️ Смарт-мани'}
                    </span>

                    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {coin.wyckoffPhase}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono-numbers">
                      <span>Объем:</span>
                      <b>{coin.volumeSurgeRatio}x</b>
                    </span>
                  </div>
                </div>

                {/* Range Corridor Visual Box */}
                <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Диапазон флэта ({coin.rangeWidthPercent}%):</span>
                    <span className="text-slate-300 font-mono-numbers">
                      ${lowFmt} – ${highFmt}
                    </span>
                  </div>

                  {/* Horizontal progress representation of current price in channel */}
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full"
                        style={{ width: `${coin.currentPositionPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono-numbers">
                      <span>Пол: ${lowFmt} (дней: ~{coin.daysInAccumulation})</span>
                      <span className="text-amber-400 font-semibold">{coin.currentPositionPercent}% в коробке</span>
                      <span>Потолок: ${highFmt}</span>
                    </div>
                  </div>

                  {/* Failed Breakouts Count */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span>Ложные пробои:</span>
                    </span>
                    <div className="flex items-center gap-2 font-mono-numbers text-[11px]">
                      <span className="text-rose-400" title="Ложные проколы вниз (Spring / Shakeout)">
                        ⬇️ Вниз: <b>{coin.failedBreakdowns}</b>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-emerald-400" title="Ложные проколы вверх (Upthrust)">
                        ⬆️ Вверх: <b>{coin.failedBreakouts}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Breakout & Algorithmic Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Цель выхода (Breakout Target):</span>
                    <span className="text-emerald-400 font-bold font-mono-numbers">
                      ${targetFmt} (+{coin.potentialUpsidePercent}%)
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    {coin.analysisSummary}
                  </p>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() =>
                      onAddTrackedCoin({
                        id: coin.symbol,
                        symbol: coin.symbol,
                        name: coin.name,
                        priceUsd: coin.priceUsd,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isTracked
                        ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isTracked ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>В мониторинге</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>В корзину (10)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyAnalysis(coin)}
                      title="Скопировать анализ аккумуляции"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                    >
                      {copiedSymbol === coin.symbol ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleSendTelegram(coin)}
                      disabled={sendingTelegramSymbol === coin.symbol}
                      title="Отправить алерт в Telegram"
                      className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-sky-950/50 rounded border border-slate-800 transition-colors"
                    >
                      {telegramSuccessSymbol === coin.symbol ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Send
                          className={`w-3.5 h-3.5 ${
                            sendingTelegramSymbol === coin.symbol ? 'animate-pulse text-sky-400' : ''
                          }`}
                        />
                      )}
                    </button>

                    <a
                      href={`https://www.tradingview.com/chart/?symbol=BINANCE:${coin.symbol}USDT`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                      title="Открыть график на TradingView"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <th className="py-3 px-4 font-semibold">Монета</th>
                <th className="py-3 px-4 font-semibold">Цена / 24ч</th>
                <th className="py-3 px-4 font-semibold">Индекс</th>
                <th className="py-3 px-4 font-semibold">Игрок &amp; Фаза</th>
                <th className="py-3 px-4 font-semibold">Всплеск объема</th>
                <th className="py-3 px-4 font-semibold">Коридор ($Low – $High)</th>
                <th className="py-3 px-4 font-semibold">Ложные выносы</th>
                <th className="py-3 px-4 font-semibold">Цель пробоя</th>
                <th className="py-3 px-4 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCoins.map((coin) => {
                const isTracked = trackedCoinSymbols.has(coin.symbol.toUpperCase());
                const priceFmt = coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(4);
                const lowFmt = coin.rangeLow < 0.01 ? coin.rangeLow.toFixed(6) : coin.rangeLow.toFixed(4);
                const highFmt = coin.rangeHigh < 0.01 ? coin.rangeHigh.toFixed(6) : coin.rangeHigh.toFixed(4);
                const targetFmt = coin.targetBreakoutUsd < 0.01 ? coin.targetBreakoutUsd.toFixed(6) : coin.targetBreakoutUsd.toFixed(4);

                return (
                  <tr key={coin.symbol} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-numbers text-sm">#{coin.symbol}</span>
                        <span className="text-slate-400 font-normal">· {coin.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <div className="font-bold text-white">${priceFmt}</div>
                      <div className={`text-[11px] ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {coin.change24h >= 0 ? `+${coin.change24h}%` : `${coin.change24h}%`}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <span className="font-bold text-emerald-400">{coin.accumulationScore}</span>
                      <span className="text-slate-500">/100</span>
                    </td>

                    <td className="py-3 px-4 space-y-1">
                      <div className="font-semibold text-slate-200">{coin.dominantActorLabel}</div>
                      <div className="text-[11px] text-slate-400">{coin.wyckoffPhase}</div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <span className="text-amber-300 font-bold">{coin.volumeSurgeRatio}x</span>
                      <div className="text-[10px] text-slate-500">выше нормы</div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <div className="text-slate-200">
                        ${lowFmt} – ${highFmt}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ширина: {coin.rangeWidthPercent}% · дн: {coin.daysInAccumulation}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400">⬇️ {coin.failedBreakdowns}</span>
                        <span className="text-emerald-400">⬆️ {coin.failedBreakouts}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono-numbers">
                      <div className="text-emerald-400 font-semibold">${targetFmt}</div>
                      <div className="text-[10px] text-emerald-500">+{coin.potentialUpsidePercent}%</div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            onAddTrackedCoin({
                              id: coin.symbol,
                              symbol: coin.symbol,
                              name: coin.name,
                              priceUsd: coin.priceUsd,
                            })
                          }
                          className={`px-2.5 py-1 rounded text-xs font-semibold ${
                            isTracked
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {isTracked ? 'В корзине ✓' : '+ Корзина'}
                        </button>
                        <button
                          onClick={() => handleSendTelegram(coin)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-800"
                          title="В Telegram"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
