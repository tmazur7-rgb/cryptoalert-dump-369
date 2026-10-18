import React from 'react';
import { X, ExternalLink, BellRing, Star, TrendingDown, ArrowDownRight, ArrowUpRight, Target, Check, Building2 } from 'lucide-react';
import { CryptoCoin, SupportedExchange } from '../types/crypto';
import { formatPrice, formatVolume } from '../utils/notifications';
import { SparklineMini } from './SparklineMini';

interface CoinDetailModalProps {
  coin: CryptoCoin | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onTestTriggerCoin: (coin: CryptoCoin) => void;
  isTracked: boolean;
  onToggleTrackedCoin: (coin: CryptoCoin) => void;
}

const EXCHANGE_CONFIGS: { id: SupportedExchange; name: string; url: (sym: string) => string }[] = [
  { id: 'binance', name: 'Binance', url: (s) => `https://www.binance.com/en/trade/${s}_USDT` },
  { id: 'bybit', name: 'Bybit', url: (s) => `https://www.bybit.com/trade/spot/${s}/USDT` },
  { id: 'okx', name: 'OKX', url: (s) => `https://www.okx.com/trade-spot/${s.toLowerCase()}-usdt` },
  { id: 'bitget', name: 'Bitget', url: (s) => `https://www.bitget.com/spot/${s}USDT` },
  { id: 'mexc', name: 'MEXC', url: (s) => `https://www.mexc.com/exchange/${s}_USDT` },
];

export const CoinDetailModal: React.FC<CoinDetailModalProps> = ({
  coin,
  onClose,
  isFavorite,
  onToggleFavorite,
  onTestTriggerCoin,
  isTracked,
  onToggleTrackedCoin,
}) => {
  if (!coin) return null;

  const isNegative = coin.change24h < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {coin.logoUrl ? (
              <img
                src={coin.logoUrl}
                alt={coin.symbol}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-8 h-8 rounded-full bg-slate-800"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                {coin.symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">{coin.symbol}</h3>
                <span className="text-xs text-slate-400 font-mono-numbers">#{coin.rank}</span>

                <button
                  onClick={() => onToggleTrackedCoin(coin)}
                  title={isTracked ? 'Удалить из списка 10 монет' : 'Добавить в список 10 монет'}
                  className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${
                    isTracked
                      ? 'bg-sky-950 text-sky-400 border border-sky-800 font-medium'
                      : 'text-slate-500 hover:text-sky-400'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{isTracked ? 'В списке 10 монет' : '+ В 10 монет'}</span>
                </button>

                <button
                  onClick={() => onToggleFavorite(coin.id)}
                  title={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                  className="text-slate-500 hover:text-amber-400 transition-colors"
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>
              <div className="text-xs text-slate-400">{coin.name} · Источник: {coin.source}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price & Drop Overview */}
        <div className="p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs text-slate-400 block mb-0.5">Текущая цена USD:</span>
              <span className="text-3xl font-extrabold font-mono-numbers text-white tracking-tight">
                {formatPrice(coin.priceUsd)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 block mb-0.5">Изменение за 24 часа:</span>
              <div className="flex items-center justify-end gap-1 font-mono-numbers font-bold text-xl">
                {isNegative ? (
                  <ArrowDownRight className="w-5 h-5 text-rose-500" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                )}
                <span className={isNegative ? 'text-rose-500' : 'text-emerald-400'}>
                  {coin.change24h > 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Sparkline & Range visualization */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Траектория цены (24ч):</span>
              <span className="font-mono-numbers text-slate-500">
                {coin.high24h ? `High: ${formatPrice(coin.high24h)}` : ''}
              </span>
            </div>
            <div className="w-full flex justify-center py-1">
              <SparklineMini data={coin.sparkline} change={coin.change24h} width={380} height={44} />
            </div>
            {coin.low24h && (
              <div className="flex justify-between text-[11px] font-mono-numbers text-slate-500">
                <span>Low: {formatPrice(coin.low24h)}</span>
                <span>High: {formatPrice(coin.high24h || coin.priceUsd)}</span>
              </div>
            )}
          </div>

          {/* Side-by-side comparison across chosen exchanges */}
          {coin.exchangeQuotes && Object.keys(coin.exchangeQuotes).length > 0 && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Сравнение цен на выбранных биржах:</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXCHANGE_CONFIGS.map((ex) => {
                  const q = coin.exchangeQuotes?.[ex.id];
                  if (!q) return null;
                  const isNeg = q.change24h < 0;

                  return (
                    <div key={ex.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                      <div className="font-bold text-slate-200">{ex.name}</div>
                      <div className="font-mono-numbers text-white font-semibold">{formatPrice(q.price)}</div>
                      <div className={`font-mono-numbers font-medium ${isNeg ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {q.change24h > 0 ? '+' : ''}{q.change24h.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* External Exchange Direct Links */}
          <div>
            <span className="text-xs text-slate-400 block mb-1.5">Открыть на биржах:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {EXCHANGE_CONFIGS.map((ex) => (
                <a
                  key={ex.id}
                  href={ex.url(coin.symbol)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <span>{ex.name}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              ))}
            </div>
          </div>

          {/* Trigger Alert Test Button */}
          <button
            onClick={() => {
              onTestTriggerCoin(coin);
            }}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <BellRing className="w-4 h-4" />
            <span>Протестировать алерт для {coin.symbol} (Звук + Уведомление)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
