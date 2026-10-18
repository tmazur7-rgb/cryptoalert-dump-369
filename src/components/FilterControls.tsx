import React from 'react';
import { Search, Play, Pause, Target, Building2, Clock, Send, Sparkles } from 'lucide-react';
import { DropPreset, ScopePreset, SupportedExchange, TriggerRule } from '../types/crypto';

interface FilterControlsProps {
  dropPreset: DropPreset;
  setDropPreset: (preset: DropPreset) => void;
  scope: ScopePreset;
  setScope: (scope: ScopePreset) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  rule: TriggerRule;
  setRule: React.Dispatch<React.SetStateAction<TriggerRule>>;
  autoScanActive: boolean;
  setAutoScanActive: (active: boolean) => void;
  trackedCoinsCount: number;
  onToggleExchange: (exchange: SupportedExchange) => void;
  onTriggerHourlyDigest?: () => void;
}

const ALL_EXCHANGES: { id: SupportedExchange; name: string }[] = [
  { id: 'binance', name: 'Binance' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'okx', name: 'OKX' },
  { id: 'bitget', name: 'Bitget' },
  { id: 'mexc', name: 'MEXC' },
];

export const FilterControls: React.FC<FilterControlsProps> = ({
  dropPreset,
  setDropPreset,
  scope,
  setScope,
  searchQuery,
  setSearchQuery,
  rule,
  setRule,
  autoScanActive,
  setAutoScanActive,
  trackedCoinsCount,
  onToggleExchange,
  onTriggerHourlyDigest,
}) => {
  const handlePresetSelect = (preset: DropPreset) => {
    setDropPreset(preset);
    if (preset === '5-20') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'range',
        minDrop: 5,
        maxDrop: 20,
        exactDropPercent: 5,
      }));
    } else if (preset === '10-20') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'range',
        minDrop: 10,
        maxDrop: 20,
        exactDropPercent: 10,
      }));
    } else if (preset === 'exact-5') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'exact',
        exactDropPercent: 5,
        minDrop: 5,
        maxDrop: 100,
      }));
    } else if (preset === 'exact-10') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'exact',
        exactDropPercent: 10,
        minDrop: 10,
        maxDrop: 100,
      }));
    } else if (preset === 'exact-15') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'exact',
        exactDropPercent: 15,
        minDrop: 15,
        maxDrop: 100,
      }));
    } else if (preset === 'exact-20') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'exact',
        exactDropPercent: 20,
        minDrop: 20,
        maxDrop: 100,
      }));
    } else if (preset === 'all') {
      setRule((prev) => ({
        ...prev,
        dropMode: 'exact',
        exactDropPercent: 0,
        minDrop: 0,
        maxDrop: 100,
      }));
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 mb-6 space-y-4">
      {/* Row 1: Timeframe Toggle & Drop Threshold Presets & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2">
          {/* Timeframe Selector (1 час vs 24 часа) */}
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium px-2 py-0.5 flex items-center gap-1 select-none">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Период:</span>
            </span>

            <button
              onClick={() => setRule((prev) => ({ ...prev, timeframe: '1h' }))}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                rule.timeframe === '1h'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              1 час (1ч)
            </button>

            <button
              onClick={() => setRule((prev) => ({ ...prev, timeframe: '24h' }))}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                rule.timeframe === '24h'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              24 часа (24ч)
            </button>
          </div>

          {/* Preset segmented buttons */}
          <div className="flex items-center flex-wrap gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
            <button
              onClick={() => handlePresetSelect('5-20')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
                dropPreset === '5-20'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>⚡ 5%–20%</span>
              <span className="text-[10px] opacity-80">({rule.timeframe === '1h' ? '1ч' : '24ч'})</span>
            </button>

            <button
              onClick={() => handlePresetSelect('10-20')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === '10-20'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              10%–20%
            </button>

            <button
              onClick={() => handlePresetSelect('exact-5')}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === 'exact-5'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              -5%
            </button>

            <button
              onClick={() => handlePresetSelect('exact-10')}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === 'exact-10'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              -10%
            </button>

            <button
              onClick={() => handlePresetSelect('exact-15')}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === 'exact-15'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              -15%
            </button>

            <button
              onClick={() => handlePresetSelect('exact-20')}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === 'exact-20'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              -20%
            </button>

            {/* Custom exact threshold input */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
              <span className="text-[11px] text-slate-400">Порог:</span>
              <div className="relative w-16">
                <input
                  type="number"
                  min="1"
                  max="95"
                  step="0.5"
                  value={rule.exactDropPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDropPreset('custom');
                    setRule((prev) => ({
                      ...prev,
                      exactDropPercent: val,
                      minDrop: val,
                      dropMode: 'exact',
                    }));
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-white font-mono-numbers text-center focus:border-rose-500 focus:outline-none"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono-numbers pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePresetSelect('all')}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                dropPreset === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Все
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по тикеру или названию (BTC, SOL)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Exchange Selector & Scan Interval (Hourly, 30m, 1m) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/70 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Биржи:</span>
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {ALL_EXCHANGES.map((ex) => {
              const isSelected = rule.selectedExchanges.includes(ex.id);
              return (
                <button
                  key={ex.id}
                  onClick={() => onToggleExchange(ex.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border flex items-center gap-1 ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 font-semibold shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-rose-400' : 'bg-slate-600'}`} />
                  <span>{ex.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-800">
            <span className="text-slate-500 text-[11px]">Расчёт:</span>
            <select
              value={rule.exchangeAggregationMode}
              onChange={(e) =>
                setRule((prev) => ({
                  ...prev,
                  exchangeAggregationMode: e.target.value as any,
                }))
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-rose-500"
            >
              <option value="any">Макс. падение на любой бирже</option>
              <option value="average">Средняя цена по биржам</option>
              <option value="first">Первая доступная биржа</option>
            </select>
          </div>
        </div>

        {/* Scan Interval, Hourly Scan & Scope */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope Selector */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Охват:</span>
            {([500, 250, 100, 50] as ScopePreset[]).map((num) => (
              <button
                key={num}
                onClick={() => setScope(num)}
                className={`px-2 py-0.5 rounded font-mono-numbers text-[11px] transition-colors ${
                  scope === num && !rule.onlyTrackedCoins
                    ? 'bg-slate-800 text-white font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                Топ-{num}
              </button>
            ))}

            <button
              onClick={() => setRule((prev) => ({ ...prev, onlyTrackedCoins: !prev.onlyTrackedCoins }))}
              className={`ml-1 flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                rule.onlyTrackedCoins
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'text-slate-400 hover:text-sky-300 hover:bg-slate-900'
              }`}
            >
              <Target className="w-3 h-3 text-sky-400" />
              <span>Мои 10 монет</span>
              <span className="font-mono-numbers">({trackedCoinsCount})</span>
            </button>
          </div>

          {/* Auto-Scan Interval Selector with Hourly Check */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <span className="text-slate-400">Скан:</span>
            <select
              value={rule.autoScanIntervalSeconds}
              onChange={(e) =>
                setRule((prev) => ({ ...prev, autoScanIntervalSeconds: Number(e.target.value) }))
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value={30}>Каждые 30 сек</option>
              <option value={60}>Каждую 1 мин</option>
              <option value={300}>Каждые 5 мин</option>
              <option value={900}>Каждые 15 мин</option>
              <option value={1800}>Каждые 30 мин</option>
              <option value={3600}>Каждый 1 час (60 мин)</option>
            </select>

            <button
              onClick={() => setAutoScanActive(!autoScanActive)}
              title={autoScanActive ? 'Приостановить автосканирование' : 'Запустить автосканирование'}
              className={`p-1 rounded border transition-colors ${
                autoScanActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {autoScanActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Hourly digest button */}
          {onTriggerHourlyDigest && rule.telegramEnabled && rule.telegramBotToken && (
            <button
              onClick={onTriggerHourlyDigest}
              title="Отправить почасовой дайджест в Telegram прямо сейчас"
              className="p-1 px-2 rounded bg-sky-950/60 border border-sky-800/80 hover:bg-sky-900/60 text-sky-300 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Часовой отчёт</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
