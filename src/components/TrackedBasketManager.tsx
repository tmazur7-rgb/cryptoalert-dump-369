import React, { useState } from 'react';
import { Target, Plus, X, Search, Check, AlertCircle, Sparkles } from 'lucide-react';
import { CryptoCoin, TrackedCoinConfig } from '../types/crypto';
import { formatPrice } from '../utils/notifications';

interface TrackedBasketManagerProps {
  trackedCoins: TrackedCoinConfig[];
  onAddCoin: (coin: CryptoCoin, targetDrop?: number) => void;
  onRemoveCoin: (id: string) => void;
  onUpdateTargetDrop: (id: string, targetDrop: number) => void;
  onSetTop10Preset: () => void;
  onClearBasket: () => void;
  onlyTrackedCoins: boolean;
  setOnlyTrackedCoins: (val: boolean) => void;
  allCoins: CryptoCoin[];
  defaultDropPercent: number;
}

export const TrackedBasketManager: React.FC<TrackedBasketManagerProps> = ({
  trackedCoins,
  onAddCoin,
  onRemoveCoin,
  onUpdateTargetDrop,
  onSetTop10Preset,
  onClearBasket,
  onlyTrackedCoins,
  setOnlyTrackedCoins,
  allCoins,
  defaultDropPercent,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isFull = trackedCoins.length >= 10;
  const remainingSlots = 10 - trackedCoins.length;

  const searchResults = allCoins
    .filter((c) => {
      if (!searchQuery) return c.rank <= 30; // show top 30 initially
      const q = searchQuery.toLowerCase().trim();
      return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    })
    .slice(0, 15);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 mb-6 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Ручной список отслеживания (до 10 монет)
              </h3>
              <span className="font-mono-numbers text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-semibold text-sky-400">
                {trackedCoins.length} / 10
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Выберите до 10 монет из Топ-500 CoinMarketCap/CoinGecko с индивидуальным порогом падения (10%, 15%, 20%).
            </p>
          </div>
        </div>

        {/* Action presets and toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOnlyTrackedCoins(!onlyTrackedCoins)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              onlyTrackedCoins
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <span>{onlyTrackedCoins ? '✓ Мониторить только эти монеты' : 'Фокус на этих 10 монетах'}</span>
          </button>

          <button
            onClick={onSetTop10Preset}
            disabled={allCoins.length === 0}
            className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors flex items-center gap-1"
            title="Заполнить Топ-10 монетами рынка"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Пресет Топ-10</span>
          </button>

          {trackedCoins.length > 0 && (
            <button
              onClick={onClearBasket}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {/* Selected Coins Chips Grid */}
      {trackedCoins.length === 0 ? (
        <div className="p-4 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Список пуст. Вы можете выбрать до 10 конкретных монет (например, BTC, ETH, SOL) для персонального мониторинга.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={onSetTop10Preset}
              className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
            >
              Заполнить монетами Топ-10 (BTC, ETH, SOL, XRP...)
            </button>
            <button
              onClick={() => setIsSearching(true)}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Выбрать вручную из Топ-500
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {trackedCoins.map((tc) => {
            const currentCoin = allCoins.find((c) => c.symbol.toUpperCase() === tc.symbol.toUpperCase());
            const drop = currentCoin?.change24h || 0;
            const isDrop = drop < 0;

            return (
              <div
                key={tc.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {tc.logoUrl ? (
                      <img src={tc.logoUrl} alt={tc.symbol} className="w-5 h-5 rounded-full bg-slate-800 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {tc.symbol.slice(0, 2)}
                      </div>
                    )}
                    <span className="font-bold text-xs text-white">{tc.symbol}</span>
                  </div>

                  <button
                    onClick={() => onRemoveCoin(tc.id)}
                    title="Удалить из списка"
                    className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {currentCoin && (
                  <div className="flex items-baseline justify-between text-[11px] font-mono-numbers">
                    <span className="text-slate-400">{formatPrice(currentCoin.priceUsd)}</span>
                    <span className={isDrop ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                      {drop > 0 ? '+' : ''}{drop.toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Drop % threshold selector for this specific coin */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-900 text-[11px]">
                  <span className="text-slate-500">Порог алерта:</span>
                  <select
                    value={tc.targetDropPercent || defaultDropPercent}
                    onChange={(e) => onUpdateTargetDrop(tc.id, Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 text-rose-400 font-mono-numbers font-bold rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-rose-500"
                  >
                    <option value={10}>-10%</option>
                    <option value={12}>-12%</option>
                    <option value={15}>-15%</option>
                    <option value={18}>-18%</option>
                    <option value={20}>-20%</option>
                    <option value={25}>-25%</option>
                  </select>
                </div>
              </div>
            );
          })}

          {!isFull && (
            <button
              onClick={() => setIsSearching(true)}
              className="p-2.5 rounded-lg border border-dashed border-slate-800 hover:border-sky-500/50 hover:bg-sky-950/10 text-slate-400 hover:text-sky-300 flex flex-col items-center justify-center gap-1 transition-colors min-h-[88px]"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-medium">Добавить монету</span>
              <span className="text-[10px] text-slate-500 font-mono-numbers">(ещё {remainingSlots})</span>
            </button>
          )}
        </div>
      )}

      {/* Manual Search & Picker Modal / Drawer */}
      {isSearching && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Поиск монеты для добавления в список (доступно {remainingSlots} из 10):
            </span>
            <button
              onClick={() => setIsSearching(false)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              Закрыть
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Введите символ или имя (BTC, ETH, SOL, NEAR, ADA, PEPE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pt-1">
            {searchResults.map((coin) => {
              const alreadyAdded = trackedCoins.some(
                (tc) => tc.symbol.toUpperCase() === coin.symbol.toUpperCase()
              );

              return (
                <button
                  key={coin.id}
                  disabled={alreadyAdded || isFull}
                  onClick={() => {
                    onAddCoin(coin, defaultDropPercent);
                    if (trackedCoins.length + 1 >= 10) setIsSearching(false);
                  }}
                  className={`p-2 rounded text-left border flex items-center justify-between text-xs transition-colors ${
                    alreadyAdded
                      ? 'bg-slate-900/40 border-slate-800/50 opacity-40 cursor-not-allowed text-slate-500'
                      : isFull
                      ? 'bg-slate-900/40 border-slate-800/50 opacity-40 cursor-not-allowed'
                      : 'bg-slate-900 border-slate-800 hover:border-sky-500 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono-numbers text-[10px] text-slate-500">#{coin.rank}</span>
                    <span className="font-bold text-white">{coin.symbol}</span>
                  </div>
                  {alreadyAdded ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
