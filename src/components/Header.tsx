import React from 'react';
import { RefreshCw, Bell, Volume2, VolumeX, ShieldAlert, Sliders, Database } from 'lucide-react';

export type AppTab = 'market' | 'losers' | 'accumulation' | 'mm-scanner' | 'fund-portfolio' | 'alerts' | 'settings' | 'providers';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  unreadAlertsCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  nextScanCountdown: number;
  autoScanActive: boolean;
  cmcConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  unreadAlertsCount,
  onRefresh,
  isRefreshing,
  soundEnabled,
  onToggleSound,
  nextScanCountdown,
  autoScanActive,
  cmcConnected,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4 lg:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <button
            onClick={() => setActiveTab('market')}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-rose-400 transition-colors whitespace-nowrap"
          >
            CryptoDrop
          </button>
          {cmcConnected && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              CMC
            </span>
          )}
        </div>

        {/* Zone 2: Navigation Links (Compact Segmented Tabs) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-1 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveTab('market')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'market'
                ? 'bg-rose-500/15 text-white border border-rose-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Рынок
          </button>

          <button
            onClick={() => setActiveTab('losers')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'losers'
                ? 'bg-rose-500/15 text-white border border-rose-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="7 страниц мониторинга падений и официальный TokenInsight API"
          >
            <span>Losers 24H</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          </button>

          <button
            onClick={() => setActiveTab('accumulation')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'accumulation'
                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Фаза аккумуляции: зоны набора позиций китами и ботами"
          >
            <span>Аккумуляция</span>
          </button>

          <button
            onClick={() => setActiveTab('mm-scanner')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'mm-scanner'
                ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="ММ / Флэт-сканер: монеты в боковике с отскоками 5–20%"
          >
            <span>ММ / Флэт</span>
          </button>

          <button
            onClick={() => setActiveTab('fund-portfolio')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'fund-portfolio'
                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Портфель фондов: пересечения инвестиций Tier 1 / Tier 2"
          >
            <span>Фонды</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-rose-500/15 text-white border border-rose-500/40 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Журнал зафиксированных алертов"
          >
            <span>Алерты</span>
            {unreadAlertsCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-mono-numbers font-bold text-white bg-rose-600 rounded">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Settings, API, Audio Quick-Toggle & Primary Scan Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            title="Настройки триггеров"
            className={`p-2 rounded-lg transition-colors border flex items-center gap-1.5 text-xs font-medium ${
              activeTab === 'settings'
                ? 'bg-rose-500/15 text-white border-rose-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden xl:inline">Настройки</span>
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            title="Статус бесплатных API и бирж"
            className={`p-2 rounded-lg transition-colors border flex items-center gap-1.5 text-xs font-medium ${
              activeTab === 'providers'
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span className="hidden xl:inline">API</span>
          </button>

          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Звук алертов включен' : 'Звук алертов выключен'}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
            aria-label="Переключить звук"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-rose-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-rose-950"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Сканирование...' : 'Сканировать'}</span>
            {autoScanActive && (
              <span className="font-mono-numbers text-[10px] bg-rose-700/60 px-1.5 py-0.5 rounded text-rose-200">
                {nextScanCountdown}с
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
