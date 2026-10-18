import React from 'react';
import { TrendingDown, AlertTriangle, Building2, Target, Clock, Zap } from 'lucide-react';
import { CryptoCoin, TriggerRule } from '../types/crypto';

interface StatsBarProps {
  coins: CryptoCoin[];
  rule: TriggerRule;
  providerName: string;
  lastUpdated: Date | null;
  notificationPermission: NotificationPermission;
  isCmcActive?: boolean;
  catalogSource?: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  coins,
  rule,
  providerName,
  lastUpdated,
  notificationPermission,
  isCmcActive,
  catalogSource,
}) => {
  const is1h = rule.timeframe === '1h';

  const getChange = (c: CryptoCoin) => (is1h && c.change1h !== undefined ? c.change1h : c.change24h);

  // Coins falling between 5% and 20%
  const drops5to20 = coins.filter((c) => {
    const chg = getChange(c);
    return chg <= -5 && chg >= -20;
  }).length;

  // Coins falling more than 20%
  const severeDumps = coins.filter((c) => {
    const chg = getChange(c);
    return chg < -20;
  }).length;

  // Total matching active rule
  const matchingRule = coins.filter((c) => {
    const chg = getChange(c);
    const mag = chg < 0 ? Math.abs(chg) : 0;
    if (rule.dropMode === 'exact') {
      return mag >= rule.exactDropPercent;
    }
    return mag >= rule.minDrop && (!rule.maxDrop || mag <= rule.maxDrop);
  }).length;

  const exchangesLabel = rule.selectedExchanges.map((e) => e.toUpperCase()).join(', ');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>Падение 5–20% ({is1h ? 'за 1 час' : 'за 24ч'})</span>
          </span>
          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono-numbers text-rose-400">{drops5to20}</span>
          <span className="text-xs text-slate-500">из {coins.length}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 truncate">
          {is1h ? 'Быстрый flash-дамп за 60 минут' : 'Суточная коррекция'}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Период &amp; Порог</span>
          </span>
          <span className="font-mono-numbers text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 font-semibold border border-sky-800">
            {is1h ? '1 ЧАС' : '24 ЧАСА'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono-numbers text-white">{matchingRule}</span>
          <span className="text-xs text-rose-400 font-semibold">
            {rule.dropMode === 'exact' ? `≥ -${rule.exactDropPercent}%` : `-${rule.minDrop}%..-${rule.maxDrop}%`}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          Скан: каждые {rule.autoScanIntervalSeconds >= 3600 ? '1 час' : rule.autoScanIntervalSeconds >= 60 ? `${rule.autoScanIntervalSeconds / 60} мин` : `${rule.autoScanIntervalSeconds} сек`}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Биржи &amp; Каталог</span>
          </span>
          {isCmcActive && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              CMC API
            </span>
          )}
        </div>
        <div className="text-sm font-bold font-mono-numbers text-slate-100 truncate mt-1">
          {exchangesLabel || 'Binance, Bybit, OKX'}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          {isCmcActive ? 'Каталог: CoinMarketCap Top 500' : (catalogSource ? `Каталог: ${catalogSource}` : 'Каталог: Топ 500')}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Монитор корзины</span>
          <Target className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono-numbers text-slate-200">
            {rule.trackedCoins.length} / 10
          </span>
          <span className="text-xs text-slate-400">{rule.onlyTrackedCoins ? 'только они' : 'в фокусе'}</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 truncate">
          <span>{notificationPermission === 'granted' ? 'Браузер ✓' : 'Браузер ✗'}</span>
          <span>·</span>
          <span>{rule.soundEnabled ? 'Звук ✓' : 'Звук ✗'}</span>
          <span>·</span>
          <span>{rule.telegramEnabled && rule.telegramBotToken ? 'TG ✓' : 'TG —'}</span>
        </div>
      </div>
    </div>
  );
};
