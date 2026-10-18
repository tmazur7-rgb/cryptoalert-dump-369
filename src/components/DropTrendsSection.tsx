import React, { useState, useMemo } from 'react';
import { Flame, Zap, ArrowDownRight, Target, ChevronDown, ChevronUp, BellRing, Sparkles, AlertTriangle } from 'lucide-react';
import { CryptoCoin, DropTrendCoin } from '../types/crypto';
import { SparklineMini } from './SparklineMini';
import { formatPrice } from '../utils/notifications';

interface DropTrendsSectionProps {
  coins: CryptoCoin[];
  onSelectCoin: (coin: CryptoCoin) => void;
  onToggleTrackedCoin: (coin: CryptoCoin) => void;
  onTestTriggerCoin: (coin: CryptoCoin) => void;
  trackedCoinsSymbols: Set<string>;
}

export const DropTrendsSection: React.FC<DropTrendsSectionProps> = ({
  coins,
  onSelectCoin,
  onToggleTrackedCoin,
  onTestTriggerCoin,
  trackedCoinsSymbols,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showCount, setShowCount] = useState<number>(4);

  // Calculate drop acceleration heuristic for all coins
  const trendCoins: DropTrendCoin[] = useMemo(() => {
    if (!coins || coins.length === 0) return [];

    const candidates = coins
      .filter((c) => {
        const c1h = c.change1h !== undefined ? c.change1h : 0;
        // Focus on coins that dropped at least 0.5% in the last 1 hour
        return c1h <= -0.5;
      })
      .map((c) => {
        const c1h = c.change1h !== undefined ? c.change1h : 0;
        const c24h = c.change24h;

        // Normal hourly speed over 24h
        const avgHourly24 = c24h < 0 ? Math.abs(c24h) / 24 : 0.08;
        // Acceleration multiplier: how many times faster it fell in the last hour vs normal 24h hourly pace
        const multiplier = Math.round((Math.abs(c1h) / Math.max(0.06, avgHourly24)) * 10) / 10;

        // Share of total 24h drop that occurred in the last hour alone
        const hourlyShare =
          c24h < 0
            ? Math.min(100, Math.round((Math.abs(c1h) / Math.abs(c24h)) * 100))
            : 100;

        // Intensity classification
        let intensity: 'critical' | 'high' | 'moderate' = 'moderate';
        if (Math.abs(c1h) >= 5 || multiplier >= 10) {
          intensity = 'critical';
        } else if (Math.abs(c1h) >= 2.5 || multiplier >= 4) {
          intensity = 'high';
        }

        // Generate concise heuristic explanation
        let heuristicReason = '';
        if (c24h > 0) {
          heuristicReason = 'Внезапный разворот: резкий дамп после суточного роста';
        } else if (hourlyShare >= 70) {
          heuristicReason = `${hourlyShare}% всего суточного падения произошло за последний час`;
        } else {
          heuristicReason = `Скорость падения в ${multiplier}x раз выше средней за сутки`;
        }

        // Composite momentum score (combining 1h drop depth and acceleration factor)
        const score = Math.abs(c1h) * (1 + Math.log10(Math.max(1, multiplier)));

        return {
          coin: c,
          drop1h: c1h,
          drop24h: c24h,
          accelerationMultiplier: multiplier,
          hourlySharePercent: hourlyShare,
          intensity,
          heuristicReason,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    return candidates;
  }, [coins]);

  if (trendCoins.length === 0) return null;

  const displayedTrends = trendCoins.slice(0, showCount);

  return (
    <div className="bg-gradient-to-r from-rose-950/20 via-slate-900 to-slate-900 border border-rose-900/30 rounded-lg p-4 mb-6 space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Тренды падения</span>
                <span className="text-[11px] font-normal text-slate-400">
                  (Наибольшее ускорение дампа за 1 час)
                </span>
              </h2>
              <span className="font-mono-numbers text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800/60">
                {trendCoins.length} аномалий
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Эвристика ускорения: выявляет монеты, где темп падения за 60 минут превышает среднюю суточную скорость в 3–20+ раз.
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
            {[4, 8].map((count) => (
              <button
                key={count}
                onClick={() => setShowCount(count)}
                className={`px-2 py-0.5 rounded transition-colors font-mono-numbers ${
                  showCount === count
                    ? 'bg-rose-900/50 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Топ-{count}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={isExpanded ? 'Свернуть тренды' : 'Развернуть тренды'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayedTrends.map((item) => {
            const { coin, drop1h, drop24h, accelerationMultiplier, hourlySharePercent, intensity, heuristicReason } = item;
            const isTracked = trackedCoinsSymbols.has(coin.symbol.toUpperCase());

            return (
              <div
                key={coin.id}
                onClick={() => onSelectCoin(coin)}
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/90 transition-all cursor-pointer group flex flex-col justify-between space-y-2.5 relative overflow-hidden"
              >
                {/* Subtle top indicator bar based on intensity */}
                <div
                  className={`absolute top-0 left-0 right-0 h-0.5 ${
                    intensity === 'critical'
                      ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                      : intensity === 'high'
                      ? 'bg-amber-500'
                      : 'bg-rose-800'
                  }`}
                />

                {/* Coin header */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {coin.logoUrl ? (
                      <img
                        src={coin.logoUrl}
                        alt={coin.symbol}
                        className="w-5 h-5 rounded-full bg-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                        {coin.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{coin.symbol}</span>
                        <span className="text-[10px] text-slate-500 font-mono-numbers">#{coin.rank}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono-numbers block truncate max-w-[90px]">
                        {formatPrice(coin.priceUsd)}
                      </span>
                    </div>
                  </div>

                  {/* 1h Drop highlight */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-0.5 font-mono-numbers font-extrabold text-sm text-rose-400">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      <span>{drop1h.toFixed(2)}%</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block">за 1 час</span>
                  </div>
                </div>

                {/* Acceleration Multiplier Badge */}
                <div className="p-1.5 rounded bg-rose-950/40 border border-rose-900/40 flex items-center justify-between text-[11px] font-mono-numbers">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Ускорение:</span>
                  </span>
                  <span className="font-bold text-amber-300">
                    {accelerationMultiplier}x быстрее нормы
                  </span>
                </div>

                {/* Comparison & Heuristic Reason */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-numbers">
                    <span>24ч тренд: {drop24h > 0 ? '+' : ''}{drop24h.toFixed(1)}%</span>
                    <span>{hourlySharePercent}% слива за час</span>
                  </div>

                  {/* Progress bar showing share of drop that occurred in last 60 mins */}
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.min(100, hourlySharePercent)}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-1 pt-0.5">
                    {heuristicReason}
                  </p>
                </div>

                {/* Sparkline & Quick Actions */}
                <div
                  className="flex items-center justify-between pt-1 border-t border-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SparklineMini data={coin.sparkline} change={drop1h} width={70} height={18} />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleTrackedCoin(coin)}
                      title={isTracked ? 'Удалить из 10 монет' : 'Добавить в отслеживаемые 10 монет'}
                      className={`p-1 rounded text-xs transition-colors ${
                        isTracked
                          ? 'text-sky-400 bg-sky-950'
                          : 'text-slate-500 hover:text-sky-400 hover:bg-slate-800'
                      }`}
                    >
                      <Target className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onTestTriggerCoin(coin)}
                      title="Протестировать алерт для этой монеты"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                    >
                      <BellRing className="w-3 h-3" />
                    </button>
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
