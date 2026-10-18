import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Star, BellRing, ExternalLink, ArrowDownRight, ArrowUpRight, Target } from 'lucide-react';
import { CryptoCoin, TriggerRule } from '../types/crypto';
import { SparklineMini } from './SparklineMini';
import { formatPrice, formatVolume } from '../utils/notifications';

interface CoinTableProps {
  coins: CryptoCoin[];
  rule: TriggerRule;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onSelectCoin: (coin: CryptoCoin) => void;
  onTestTriggerCoin: (coin: CryptoCoin) => void;
  isLoading: boolean;
  onToggleTrackedCoin: (coin: CryptoCoin) => void;
}

type SortField = 'rank' | 'change1h' | 'change24h' | 'price' | 'volume';
type SortOrder = 'asc' | 'desc';

export const CoinTable: React.FC<CoinTableProps> = ({
  coins,
  rule,
  favorites,
  onToggleFavorite,
  onSelectCoin,
  onTestTriggerCoin,
  isLoading,
  onToggleTrackedCoin,
}) => {
  // If timeframe is 1h, default sort by change1h ascending (biggest 1h drop first!)
  const [sortField, setSortField] = useState<SortField>(rule.timeframe === '1h' ? 'change1h' : 'change24h');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'change1h' || field === 'change24h' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const sortedCoins = useMemo(() => {
    const list = [...coins];
    return list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortField === 'rank') {
        valA = a.rank;
        valB = b.rank;
      } else if (sortField === 'change1h') {
        valA = a.change1h !== undefined ? a.change1h : a.change24h;
        valB = b.change1h !== undefined ? b.change1h : b.change24h;
      } else if (sortField === 'change24h') {
        valA = a.change24h;
        valB = b.change24h;
      } else if (sortField === 'price') {
        valA = a.priceUsd;
        valB = b.priceUsd;
      } else if (sortField === 'volume') {
        valA = a.volume24h;
        valB = b.volume24h;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [coins, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedCoins.length / pageSize) || 1;
  const paginatedCoins = sortedCoins.slice((page - 1) * pageSize, page * pageSize);

  const isTracked = (coin: CryptoCoin) =>
    rule.trackedCoins.some((tc) => tc.symbol.toUpperCase() === coin.symbol.toUpperCase());

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Найдено монет: <strong className="text-white font-mono-numbers">{sortedCoins.length}</strong></span>
          <span>·</span>
          <span>Период отслеживания: <strong className={rule.timeframe === '1h' ? 'text-sky-400 font-bold' : 'text-slate-200'}>
            {rule.timeframe === '1h' ? '1 час (почасовой)' : '24 часа'}
          </strong></span>
          <span>·</span>
          <span>Биржи: <strong className="text-slate-200">{rule.selectedExchanges.map(e => e.toUpperCase()).join(', ')}</strong></span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>Страница {page} из {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-300"
              >
                ‹ Назад
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-300"
              >
                Вперед ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Responsive Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400 tracking-wider">
              <th className="py-2.5 px-2 w-8 text-center" title="Добавить в отслеживаемые 10 монет">🎯</th>
              <th className="py-2.5 px-2 w-8 text-center">⭐</th>
              <th
                onClick={() => handleSort('rank')}
                className="py-2.5 px-3 w-14 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Ранг</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 min-w-[170px]">Монета</th>
              <th
                onClick={() => handleSort('price')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Цена USD</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* 1 Hour Change Column */}
              <th
                onClick={() => handleSort('change1h')}
                className={`py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors min-w-[110px] ${
                  rule.timeframe === '1h' ? 'bg-sky-950/30' : ''
                }`}
              >
                <div className="flex items-center justify-end gap-1">
                  <span className={rule.timeframe === '1h' ? 'text-sky-300 font-bold' : 'text-slate-300'}>
                    1ч Дамп %
                  </span>
                  <ArrowUpDown className={`w-3 h-3 ${rule.timeframe === '1h' ? 'text-sky-400' : ''}`} />
                </div>
              </th>

              {/* 24 Hour Change Column */}
              <th
                onClick={() => handleSort('change24h')}
                className={`py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors min-w-[120px] ${
                  rule.timeframe === '24h' ? 'bg-rose-950/20' : ''
                }`}
              >
                <div className="flex items-center justify-end gap-1">
                  <span className={rule.timeframe === '24h' ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    24ч Падение %
                  </span>
                  <ArrowUpDown className={`w-3 h-3 ${rule.timeframe === '24h' ? 'text-rose-400' : ''}`} />
                </div>
              </th>

              <th
                onClick={() => handleSort('volume')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors hidden sm:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Объём 24ч</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center hidden md:table-cell w-24">Траектория</th>
              <th className="py-2.5 px-3 text-right w-24">Действия</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 text-xs">
            {isLoading && paginatedCoins.length === 0 ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse bg-slate-900/30">
                  <td className="py-3 px-2"><div className="w-4 h-4 bg-slate-800 rounded mx-auto" /></td>
                  <td className="py-3 px-2"><div className="w-4 h-4 bg-slate-800 rounded mx-auto" /></td>
                  <td className="py-3 px-3"><div className="w-6 h-4 bg-slate-800 rounded" /></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800" />
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right"><div className="w-16 h-4 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="w-14 h-4 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="w-16 h-4 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right hidden sm:table-cell"><div className="w-20 h-4 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 hidden md:table-cell"><div className="w-20 h-5 bg-slate-800 rounded mx-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="w-14 h-5 bg-slate-800 rounded ml-auto" /></td>
                </tr>
              ))
            ) : paginatedCoins.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium text-slate-300 mb-1">Монеты под заданный фильтр не найдены</p>
                  <p className="text-xs text-slate-500">
                    Попробуйте переключить период (1ч / 24ч) или выбрать фильтр "Все".
                  </p>
                </td>
              </tr>
            ) : (
              paginatedCoins.map((coin) => {
                const isFavorite = favorites.has(coin.id);
                const tracked = isTracked(coin);

                const c1h = coin.change1h !== undefined ? coin.change1h : 0;
                const is1hNeg = c1h < 0;
                const is1hDrop5to20 = c1h <= -5 && c1h >= -20;
                const is1hSevere = c1h < -20;

                const c24h = coin.change24h;
                const is24hNeg = c24h < 0;
                const is24hTargetDrop = c24h <= -10 && c24h >= -20;
                const is24hSevere = c24h < -20;

                const isHourlyView = rule.timeframe === '1h';

                return (
                  <tr
                    key={coin.id}
                    className={`transition-colors hover:bg-slate-800/40 group cursor-pointer ${
                      tracked
                        ? 'bg-sky-950/20'
                        : isHourlyView && is1hDrop5to20
                        ? 'bg-rose-950/30'
                        : isHourlyView && is1hSevere
                        ? 'bg-amber-950/30'
                        : !isHourlyView && is24hTargetDrop
                        ? 'bg-rose-950/20'
                        : ''
                    }`}
                    onClick={() => onSelectCoin(coin)}
                  >
                    {/* Add to 10 Tracked Coins Basket */}
                    <td
                      className="py-2.5 px-2 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTrackedCoin(coin);
                      }}
                    >
                      <button
                        title={tracked ? 'Удалить из списка 10 монет' : 'Добавить в список 10 монет'}
                        className={`p-1 rounded transition-colors ${
                          tracked
                            ? 'text-sky-400 bg-sky-950/60 hover:text-rose-400'
                            : 'text-slate-600 hover:text-sky-400'
                        }`}
                      >
                        <Target className={`w-3.5 h-3.5 ${tracked ? 'fill-sky-400/20' : ''}`} />
                      </button>
                    </td>

                    {/* Star Favorite */}
                    <td
                      className="py-2.5 px-2 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(coin.id);
                      }}
                    >
                      <button
                        title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        className="text-slate-600 hover:text-amber-400 transition-colors p-1"
                      >
                        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* Rank */}
                    <td className="py-2.5 px-3 font-mono-numbers text-slate-400 text-[11px]">
                      #{coin.rank}
                    </td>

                    {/* Coin Symbol & Name & Source Exchange */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {coin.logoUrl ? (
                          <img
                            src={coin.logoUrl}
                            alt={coin.symbol}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-5 h-5 rounded-full bg-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">
                            {coin.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white tracking-wide">{coin.symbol}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[85px]">{coin.name}</span>
                            {tracked && (
                              <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                                10
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono-numbers block truncate max-w-[120px]">
                            {coin.source}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Price USD */}
                    <td className="py-2.5 px-3 text-right font-mono-numbers font-medium text-slate-200">
                      {formatPrice(coin.priceUsd)}
                    </td>

                    {/* 1 Hour Change Column */}
                    <td className={`py-2.5 px-3 text-right font-mono-numbers ${isHourlyView ? 'bg-sky-950/20' : ''}`}>
                      {coin.change1h !== undefined ? (
                        <div className="inline-flex items-center gap-0.5 font-bold">
                          {is1hNeg ? (
                            <ArrowDownRight className="w-3 h-3 text-rose-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          )}
                          <span
                            className={
                              is1hDrop5to20
                                ? 'text-rose-400 font-extrabold text-xs'
                                : is1hNeg
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }
                          >
                            {c1h > 0 ? '+' : ''}{c1h.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* 24 Hour Change Column */}
                    <td className={`py-2.5 px-3 text-right font-mono-numbers ${!isHourlyView ? 'bg-rose-950/10' : ''}`}>
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-0.5 font-bold">
                          {is24hNeg ? (
                            <ArrowDownRight className="w-3 h-3 text-rose-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          )}
                          <span
                            className={
                              is24hTargetDrop
                                ? 'text-rose-400 font-extrabold text-xs'
                                : is24hNeg
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }
                          >
                            {c24h > 0 ? '+' : ''}{c24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 24h Volume */}
                    <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-400 hidden sm:table-cell text-[11px]">
                      {formatVolume(coin.volume24h)}
                    </td>

                    {/* Sparkline */}
                    <td className="py-2.5 px-3 text-center hidden md:table-cell">
                      <SparklineMini data={coin.sparkline} change={isHourlyView ? c1h : c24h} width={80} height={22} />
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onTestTriggerCoin(coin)}
                          title="Протестировать алерт (звук + пуш)"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=BINANCE:${coin.symbol}USDT`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="График TradingView"
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
