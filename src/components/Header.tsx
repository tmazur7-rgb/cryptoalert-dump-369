import React from 'react';
import { RefreshCw, Bell, Volume2, VolumeX, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  activeTab: 'market' | 'alerts' | 'settings' | 'providers';
  setActiveTab: (tab: 'market' | 'alerts' | 'settings' | 'providers') => void;
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
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element wordmark, no tags or descriptors) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <button
            onClick={() => setActiveTab('market')}
            className="text-lg font-bold tracking-tight text-white hover:text-rose-400 transition-colors whitespace-nowrap"
          >
            CryptoDrop Alert
          </button>
          {cmcConnected && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              CMC PRO
            </span>
          )}
        </div>

        {/* Zone 2: 4 Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('market')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'market'
                ? 'text-white underline underline-offset-8 decoration-rose-500 decoration-2 font-semibold'
                : 'text-slate-400'
            }`}
          >
            Монитор рынка
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`whitespace-nowrap relative transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'text-white underline underline-offset-8 decoration-rose-500 decoration-2 font-semibold'
                : 'text-slate-400'
            }`}
          >
            <span>Журнал алертов</span>
            {unreadAlertsCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-mono-numbers font-bold text-rose-100 bg-rose-600 rounded">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'settings'
                ? 'text-white underline underline-offset-8 decoration-rose-500 decoration-2 font-semibold'
                : 'text-slate-400'
            }`}
          >
            Настройки триггеров
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'providers'
                ? 'text-white underline underline-offset-8 decoration-rose-500 decoration-2 font-semibold'
                : 'text-slate-400'
            }`}
          >
            Статус API
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action with Sound Quick-Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Звук алертов включен (нажмите чтобы выключить)' : 'Звук алертов выключен'}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
            aria-label="Переключить звук"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-rose-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-rose-950"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Сканирование...' : 'Сканировать'}</span>
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
