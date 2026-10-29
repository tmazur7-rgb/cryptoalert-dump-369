import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CryptoCoin,
  DropPreset,
  ScopePreset,
  SupportedExchange,
  TriggerRule,
  TriggeredAlert,
  TrackedCoinConfig,
} from './types/crypto';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { FilterControls } from './components/FilterControls';
import { TrackedBasketManager } from './components/TrackedBasketManager';
import { DropTrendsSection } from './components/DropTrendsSection';
import { CoinTable } from './components/CoinTable';
import { TriggeredAlertsDrawer } from './components/TriggeredAlertsDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ApiStatusModal } from './components/ApiStatusModal';
import { CoinDetailModal } from './components/CoinDetailModal';
import { MmRangeScanner } from './components/MmRangeScanner';
import { FundPortfolioBuilder } from './components/FundPortfolioBuilder';
import { AccumulationPhaseScanner } from './components/AccumulationPhaseScanner';
import { LosersAggregatorSection } from './components/LosersAggregatorSection';
import { playAlertSound } from './utils/audio';
import {
  getNotificationPermissionStatus,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
  sendTelegramAlert,
  sendHourlyDigestToTelegram,
  shouldTriggerAlert,
} from './utils/notifications';
import { Bell, X, ShieldAlert } from 'lucide-react';

const DEFAULT_RULE: TriggerRule = {
  minDrop: 5,
  maxDrop: 20, // Default 5-20% drop as requested
  dropMode: 'range', // 'exact' or 'range'
  exactDropPercent: 5,
  timeframe: '1h', // Default 1 hour (every hour tracking)
  minVolumeUsd: 100000,
  scope: 500, // Top 500 coins from CoinMarketCap/CoinGecko catalog
  soundEnabled: true,
  soundType: 'chime',
  browserNotifyEnabled: true,
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  autoScanIntervalSeconds: 60, // Default 1 min check, supports up to 1 hour
  hourlyDigestEnabled: true,
  selectedExchanges: ['binance', 'bybit', 'okx', 'bitget', 'mexc'],
  exchangeAggregationMode: 'any',
  trackedCoins: [], // User can choose up to 10 coins
  onlyTrackedCoins: false,
  cmcApiKey: '',
  useCmcCatalog: true,
  tokenInsightApiKey: '',
  useTokenInsight: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'market' | 'losers' | 'accumulation' | 'mm-scanner' | 'fund-portfolio' | 'alerts' | 'settings' | 'providers'>('market');

  const [dropPreset, setDropPreset] = useState<DropPreset>('5-20');
  const [scope, setScope] = useState<ScopePreset>(500);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rule, setRule] = useState<TriggerRule>(() => {
    try {
      const saved = localStorage.getItem('cryptodrop_rule_v3');
      if (saved) return { ...DEFAULT_RULE, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_RULE;
  });

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cryptodrop_favorites');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set<string>();
  });

  const [alerts, setAlerts] = useState<TriggeredAlert[]>(() => {
    try {
      const saved = localStorage.getItem('cryptodrop_alerts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [coins, setCoins] = useState<CryptoCoin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [providerName, setProviderName] = useState<string>('Выбранные биржи');
  const [catalogSource, setCatalogSource] = useState<string>('Топ 500');
  const [isCmcActive, setIsCmcActive] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [selectedCoin, setSelectedCoin] = useState<CryptoCoin | null>(null);

  const [autoScanActive, setAutoScanActive] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(rule.autoScanIntervalSeconds);
  const [latestToast, setLatestToast] = useState<{ symbol: string; drop: number; price: number; threshold: string } | null>(null);

  const lastHourlyDigestRef = useRef<number>(Date.now());

  // Save rule to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cryptodrop_rule_v3', JSON.stringify(rule));
    } catch {}
  }, [rule]);

  useEffect(() => {
    try {
      localStorage.setItem('cryptodrop_favorites', JSON.stringify(Array.from(favorites)));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('cryptodrop_alerts', JSON.stringify(alerts.slice(0, 150)));
    } catch {}
  }, [alerts]);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleExchange = (ex: SupportedExchange) => {
    setRule((prev) => {
      const exists = prev.selectedExchanges.includes(ex);
      if (exists) {
        if (prev.selectedExchanges.length === 1) return prev; // keep at least one
        return { ...prev, selectedExchanges: prev.selectedExchanges.filter((e) => e !== ex) };
      }
      return { ...prev, selectedExchanges: [...prev.selectedExchanges, ex] };
    });
  };

  // Add / remove tracked coins (up to 10 coins max)
  const handleAddTrackedCoin = (coin: CryptoCoin, targetDrop?: number) => {
    setRule((prev) => {
      if (prev.trackedCoins.length >= 10) return prev;
      const already = prev.trackedCoins.some((c) => c.symbol.toUpperCase() === coin.symbol.toUpperCase());
      if (already) return prev;

      const newCoin: TrackedCoinConfig = {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        targetDropPercent: targetDrop || prev.exactDropPercent || 5,
        logoUrl: coin.logoUrl,
      };
      return {
        ...prev,
        trackedCoins: [...prev.trackedCoins, newCoin],
      };
    });
  };

  const handleAddMultipleTrackedCoins = (
    coinsList: { id: string; symbol: string; name: string; priceUsd: number }[]
  ) => {
    setRule((prev) => {
      const existing = new Set(prev.trackedCoins.map((c) => c.symbol.toUpperCase()));
      const newItems: TrackedCoinConfig[] = [];
      for (const c of coinsList) {
        if (prev.trackedCoins.length + newItems.length >= 10) break;
        if (!existing.has(c.symbol.toUpperCase())) {
          existing.add(c.symbol.toUpperCase());
          newItems.push({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            targetDropPercent: prev.exactDropPercent || 5,
          });
        }
      }
      if (newItems.length === 0) return prev;
      return {
        ...prev,
        trackedCoins: [...prev.trackedCoins, ...newItems],
      };
    });
  };

  const handleRemoveTrackedCoin = (id: string) => {
    setRule((prev) => ({
      ...prev,
      trackedCoins: prev.trackedCoins.filter((c) => c.id !== id && c.symbol.toLowerCase() !== id.toLowerCase()),
    }));
  };

  const handleToggleTrackedCoin = (coin: CryptoCoin) => {
    const isAlready = rule.trackedCoins.some(
      (tc) => tc.id === coin.id || tc.symbol.toUpperCase() === coin.symbol.toUpperCase()
    );
    if (isAlready) {
      handleRemoveTrackedCoin(coin.id);
    } else {
      handleAddTrackedCoin(coin, rule.exactDropPercent || 5);
    }
  };

  const handleUpdateTargetDrop = (id: string, targetDrop: number) => {
    setRule((prev) => ({
      ...prev,
      trackedCoins: prev.trackedCoins.map((c) => (c.id === id ? { ...c, targetDropPercent: targetDrop } : c)),
    }));
  };

  const handleSetTop10Preset = () => {
    if (coins.length === 0) return;
    const top10 = coins.slice(0, 10).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      targetDropPercent: rule.exactDropPercent || 5,
      logoUrl: c.logoUrl,
    }));
    setRule((prev) => ({ ...prev, trackedCoins: top10 }));
  };

  const handleClearBasket = () => {
    setRule((prev) => ({ ...prev, trackedCoins: [] }));
  };

  // Trigger alert dispatch for a coin
  const triggerAlertForCoin = useCallback(
    (coin: CryptoCoin, thresholdStr?: string) => {
      const is1h = rule.timeframe === '1h';
      const changeVal = is1h
        ? (coin.change1h !== undefined ? coin.change1h : coin.change24h)
        : coin.change24h;
      const dropMagnitude = Math.abs(changeVal);
      const tfLabel = is1h ? '1ч' : '24ч';
      const activeThreshold = thresholdStr || (rule.dropMode === 'exact' ? `-${rule.exactDropPercent}% (${tfLabel})` : `-${rule.minDrop}%..-${rule.maxDrop}% (${tfLabel})`);

      if (rule.soundEnabled) {
        playAlertSound(rule.soundType);
      }

      if (rule.browserNotifyEnabled) {
        sendBrowserNotification(
          `🚨 ПАДЕНИЕ ${coin.symbol}: -${dropMagnitude.toFixed(2)}%! [${activeThreshold}]`,
          `Цена: $${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(2)} | Биржа: ${coin.source} | Период: ${tfLabel}`,
          coin.logoUrl
        );
      }

      if (rule.telegramEnabled && rule.telegramBotToken && rule.telegramChatId) {
        sendTelegramAlert(rule, coin, tfLabel, activeThreshold).catch(() => {});
      }

      const newAlert: TriggeredAlert = {
        id: `${coin.id}_${Date.now()}`,
        coinId: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        dropPercent: changeVal,
        price: coin.priceUsd,
        timestamp: Date.now(),
        source: coin.source,
        timeframe: is1h ? '1 час' : '24 часа',
        read: false,
        thresholdTriggered: activeThreshold,
      };

      setAlerts((prev) => [newAlert, ...prev.slice(0, 149)]);

      setLatestToast({
        symbol: coin.symbol,
        drop: dropMagnitude,
        price: coin.priceUsd,
        threshold: activeThreshold,
      });

      setTimeout(() => {
        setLatestToast(null);
      }, 7000);
    },
    [rule]
  );

  // Manual Trigger for Hourly Digest
  const handleTriggerHourlyDigest = useCallback(async () => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      alert('Укажите Telegram Bot Token и Chat ID во вкладке "Настройки триггеров"');
      return;
    }

    const is1h = rule.timeframe === '1h';
    const drops = coins
      .filter((c) => {
        const val = is1h ? (c.change1h !== undefined ? c.change1h : c.change24h) : c.change24h;
        return val <= -5 && val >= -20;
      })
      .map((c) => ({
        symbol: c.symbol,
        dropPercent: is1h ? (c.change1h !== undefined ? c.change1h : c.change24h) : c.change24h,
        price: c.priceUsd,
      }));

    const res = await sendHourlyDigestToTelegram(
      rule,
      drops,
      is1h ? 'За последний 1 час (Flash-дамп 5–20%)' : 'За последние 24 часа (5–20%)'
    );

    if (res.success) {
      alert(`Почасовой дайджест успешно отправлен в Telegram! Найдено монет: ${drops.length}`);
    } else {
      alert(`Ошибка отправки дайджеста: ${res.error}`);
    }
  }, [coins, rule]);

  // Fetch crypto market data from selected exchanges proxy
  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      const exchangesStr = rule.selectedExchanges.join(',');
      const queryParams = new URLSearchParams({
        exchanges: exchangesStr,
        aggregationMode: rule.exchangeAggregationMode,
        limit: String(scope),
        timeframe: rule.timeframe,
      });

      if (rule.cmcApiKey?.trim() && rule.useCmcCatalog !== false) {
        queryParams.set('cmcApiKey', rule.cmcApiKey.trim());
      }

      const res = await fetch(`/api/crypto/coins?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.coins)) {
        setCoins(data.coins);
        const activeExStr = (data.activeExchanges || rule.selectedExchanges).map((e: string) => e.toUpperCase()).join(', ');
        const cmcEnabled = Boolean(data.cmcActive);
        setProviderName(cmcEnabled ? `CMC + ${activeExStr}` : activeExStr);
        setCatalogSource(data.catalogSource || (cmcEnabled ? 'CoinMarketCap' : 'CoinGecko'));
        setIsCmcActive(cmcEnabled);
        setLastUpdated(new Date());

        // Scan for new drops matching rule
        data.coins.forEach((coin: CryptoCoin) => {
          const check = shouldTriggerAlert(coin, rule);
          if (check.trigger) {
            triggerAlertForCoin(coin, check.thresholdTriggered);
          }
        });

        // Automatic hourly digest if 1 hour has elapsed
        const now = Date.now();
        if (
          rule.hourlyDigestEnabled &&
          rule.telegramEnabled &&
          rule.telegramBotToken &&
          rule.telegramChatId &&
          now - lastHourlyDigestRef.current >= 3600 * 1000
        ) {
          lastHourlyDigestRef.current = now;
          const is1h = rule.timeframe === '1h';
          const drops = data.coins
            .filter((c: CryptoCoin) => {
              const val = is1h ? (c.change1h !== undefined ? c.change1h : c.change24h) : c.change24h;
              return val <= -5 && val >= -20;
            })
            .map((c: CryptoCoin) => ({
              symbol: c.symbol,
              dropPercent: is1h ? (c.change1h !== undefined ? c.change1h : c.change24h) : c.change24h,
              price: c.priceUsd,
            }));

          sendHourlyDigestToTelegram(rule, drops, 'Автоматический почасовой дайджест (5–20%)').catch(() => {});
        }
      }
    } catch (err) {
      console.error('Market fetch error:', err);
    } finally {
      setIsLoading(false);
      setCountdown(rule.autoScanIntervalSeconds);
    }
  }, [rule, scope, triggerAlertForCoin]);

  useEffect(() => {
    fetchMarketData();
  }, [rule.selectedExchanges, rule.exchangeAggregationMode, rule.timeframe, scope]);

  // Countdown timer for auto-scan
  useEffect(() => {
    if (!autoScanActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchMarketData();
          return rule.autoScanIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoScanActive, rule.autoScanIntervalSeconds, fetchMarketData]);

  // Filtered coins list
  const displayedCoins = coins.filter((coin) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchSymbol = coin.symbol.toLowerCase().includes(q);
      const matchName = coin.name.toLowerCase().includes(q);
      if (!matchSymbol && !matchName) return false;
    }

    if (rule.onlyTrackedCoins) {
      const isTracked = rule.trackedCoins.some(
        (tc) => tc.symbol.toUpperCase() === coin.symbol.toUpperCase()
      );
      if (!isTracked) return false;
    }

    const is1h = rule.timeframe === '1h';
    const rawChange = is1h
      ? (coin.change1h !== undefined ? coin.change1h : coin.change24h)
      : coin.change24h;

    const dropMag = rawChange < 0 ? Math.abs(rawChange) : 0;

    if (dropPreset === '5-20') return dropMag >= 5 && dropMag <= 20;
    if (dropPreset === '10-20') return dropMag >= 10 && dropMag <= 20;
    if (dropPreset === 'exact-5') return dropMag >= 5;
    if (dropPreset === 'exact-10') return dropMag >= 10;
    if (dropPreset === 'exact-15') return dropMag >= 15;
    if (dropPreset === 'exact-20') return dropMag >= 20;
    if (dropPreset === 'custom') {
      if (rule.dropMode === 'exact') return dropMag >= rule.exactDropPercent;
      return dropMag >= rule.minDrop && (!rule.maxDrop || dropMag <= rule.maxDrop);
    }

    return true;
  });

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadAlertsCount={unreadAlertsCount}
        onRefresh={fetchMarketData}
        isRefreshing={isLoading}
        soundEnabled={rule.soundEnabled}
        onToggleSound={() => setRule((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
        nextScanCountdown={countdown}
        autoScanActive={autoScanActive}
        cmcConnected={isCmcActive}
      />

      {latestToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div className="bg-rose-950 border border-rose-500/50 rounded-xl p-4 shadow-2xl flex items-center gap-3.5 max-w-md">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🚨 КРИПТО ДРОП:</span>
                <span className="text-rose-400 font-mono-numbers">{latestToast.symbol}</span>
                <span className="text-rose-400 font-mono-numbers font-extrabold">
                  -{latestToast.drop.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-400">({latestToast.threshold})</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 font-mono-numbers">
                Цена: ${latestToast.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button onClick={() => setLatestToast(null)} className="text-slate-400 hover:text-white p-1 ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notifPermission !== 'granted' && (
          <div className="mb-6 p-3.5 bg-slate-900 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Bell className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Включите системные уведомления для получения алертов о падении на 5–20% каждый час даже при свернутом браузере.
              </span>
            </div>
            <button
              onClick={async () => {
                const res = await requestBrowserNotificationPermission();
                setNotifPermission(res);
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded transition-colors whitespace-nowrap"
            >
              Включить пуш-уведомления
            </button>
          </div>
        )}

        {activeTab === 'market' && (
          <div>
            <StatsBar
              coins={coins}
              rule={rule}
              providerName={providerName}
              lastUpdated={lastUpdated}
              notificationPermission={notifPermission}
              isCmcActive={isCmcActive}
              catalogSource={catalogSource}
              onOpenLosers={() => setActiveTab('losers')}
              onOpenAccumulation={() => setActiveTab('accumulation')}
              onOpenMmScanner={() => setActiveTab('mm-scanner')}
              onOpenFundPortfolio={() => setActiveTab('fund-portfolio')}
            />

            {/* Drop Trends: Coins with highest drop acceleration over the last hour */}
            <DropTrendsSection
              coins={coins}
              onSelectCoin={(c) => setSelectedCoin(c)}
              onToggleTrackedCoin={handleToggleTrackedCoin}
              onTestTriggerCoin={(c) => triggerAlertForCoin(c, 'Тест из трендов')}
              trackedCoinsSymbols={new Set(rule.trackedCoins.map((tc) => tc.symbol.toUpperCase()))}
            />

            {/* Manual Basket of up to 10 coins */}
            <TrackedBasketManager
              trackedCoins={rule.trackedCoins}
              onAddCoin={handleAddTrackedCoin}
              onRemoveCoin={handleRemoveTrackedCoin}
              onUpdateTargetDrop={handleUpdateTargetDrop}
              onSetTop10Preset={handleSetTop10Preset}
              onClearBasket={handleClearBasket}
              onlyTrackedCoins={rule.onlyTrackedCoins}
              setOnlyTrackedCoins={(val) => setRule((prev) => ({ ...prev, onlyTrackedCoins: val }))}
              allCoins={coins}
              defaultDropPercent={rule.exactDropPercent || 5}
            />

            <FilterControls
              dropPreset={dropPreset}
              setDropPreset={setDropPreset}
              scope={scope}
              setScope={setScope}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              rule={rule}
              setRule={setRule}
              autoScanActive={autoScanActive}
              setAutoScanActive={setAutoScanActive}
              trackedCoinsCount={rule.trackedCoins.length}
              onToggleExchange={handleToggleExchange}
              onTriggerHourlyDigest={handleTriggerHourlyDigest}
            />

            <CoinTable
              coins={displayedCoins}
              rule={rule}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onSelectCoin={(c) => setSelectedCoin(c)}
              onTestTriggerCoin={(c) => triggerAlertForCoin(c, 'Ручной тест')}
              isLoading={isLoading}
              onToggleTrackedCoin={handleToggleTrackedCoin}
            />
          </div>
        )}

        {activeTab === 'losers' && (
          <LosersAggregatorSection
            rule={rule}
            onAddTrackedCoin={(c) => {
              handleAddTrackedCoin({
                id: c.id,
                symbol: c.symbol,
                name: c.name,
                rank: 1,
                priceUsd: c.priceUsd,
                change24h: 0,
                volume24h: 0,
                source: 'TokenInsight / Losers Aggregator',
                updatedAt: new Date().toISOString(),
              });
            }}
            onOpenSettings={() => setActiveTab('settings')}
            trackedCoinsSymbols={new Set(rule.trackedCoins.map((tc) => tc.symbol.toUpperCase()))}
          />
        )}

        {activeTab === 'accumulation' && (
          <AccumulationPhaseScanner
            rule={rule}
            onAddTrackedCoin={(c) => {
              handleAddTrackedCoin({
                id: c.id,
                symbol: c.symbol,
                name: c.name,
                rank: 1,
                priceUsd: c.priceUsd,
                change24h: 0,
                volume24h: 0,
                source: 'Accumulation Scanner',
                updatedAt: new Date().toISOString(),
              });
            }}
            trackedCoinSymbols={new Set(rule.trackedCoins.map((tc) => tc.symbol.toUpperCase()))}
          />
        )}

        {activeTab === 'mm-scanner' && (
          <MmRangeScanner
            rule={rule}
            onAddTrackedCoin={(c) => {
              handleAddTrackedCoin({
                id: c.id,
                symbol: c.symbol,
                name: c.name,
                rank: 1,
                priceUsd: c.priceUsd,
                change24h: 0,
                volume24h: 0,
                source: 'MM Scanner',
                updatedAt: new Date().toISOString(),
              });
            }}
            trackedCoinSymbols={new Set(rule.trackedCoins.map((tc) => tc.symbol.toUpperCase()))}
          />
        )}

        {activeTab === 'fund-portfolio' && (
          <FundPortfolioBuilder
            coins={coins}
            rule={rule}
            onAddTrackedCoin={(c) => {
              handleAddTrackedCoin({
                id: c.id,
                symbol: c.symbol,
                name: c.name,
                rank: 1,
                priceUsd: c.priceUsd,
                change24h: 0,
                volume24h: 0,
                source: 'Fund Portfolio',
                updatedAt: new Date().toISOString(),
              });
            }}
            onAddMultipleTrackedCoins={handleAddMultipleTrackedCoins}
            trackedCoinSymbols={new Set(rule.trackedCoins.map((tc) => tc.symbol.toUpperCase()))}
          />
        )}

        {activeTab === 'alerts' && (
          <TriggeredAlertsDrawer
            alerts={alerts}
            onMarkAllAsRead={() => setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))}
            onClearAlerts={() => setAlerts([])}
            onResendTelegram={(a) => {
              const dummyCoin: CryptoCoin = {
                id: a.coinId,
                symbol: a.symbol,
                name: a.name,
                rank: 1,
                priceUsd: a.price,
                change24h: a.dropPercent,
                volume24h: 1000000,
                source: a.source,
                updatedAt: new Date().toISOString(),
              };
              sendTelegramAlert(rule, dummyCoin, a.timeframe, a.thresholdTriggered).then((res) => {
                if (res.success) {
                  alert('Оповещение успешно отправлено в Telegram!');
                } else {
                  alert(`Ошибка отправки: ${res.error}`);
                }
              });
            }}
            rule={rule}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModal
            rule={rule}
            setRule={setRule}
            notificationPermission={notifPermission}
            setNotificationPermission={setNotifPermission}
          />
        )}

        {activeTab === 'providers' && (
          <ApiStatusModal
            cmcApiKey={rule.cmcApiKey}
            tokenInsightApiKey={rule.tokenInsightApiKey}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}
      </main>

      {selectedCoin && (
        <CoinDetailModal
          coin={selectedCoin}
          onClose={() => setSelectedCoin(null)}
          isFavorite={favorites.has(selectedCoin.id)}
          onToggleFavorite={toggleFavorite}
          onTestTriggerCoin={(c) => triggerAlertForCoin(c, 'Тест из деталей')}
          isTracked={rule.trackedCoins.some((tc) => tc.symbol.toUpperCase() === selectedCoin.symbol.toUpperCase())}
          onToggleTrackedCoin={handleToggleTrackedCoin}
        />
      )}

      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>CryptoDrop Alert · Монитор падений 5–20% каждый час (Binance, Bybit, OKX, Bitget, MEXC)</div>
          <div className="flex items-center gap-4 font-mono-numbers">
            {rule.selectedExchanges.map((ex) => (
              <span key={ex} className="text-slate-400">
                {ex.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
