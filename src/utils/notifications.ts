import { TriggeredAlert, TriggerRule, CryptoCoin, TrackedCoinConfig } from '../types/crypto';
import { playAlertSound } from './audio';

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export function sendBrowserNotification(title: string, body: string, icon?: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notif = new Notification(title, {
      body,
      icon: icon || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
      badge: icon,
      silent: true,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    setTimeout(() => {
      try {
        notif.close();
      } catch {}
    }, 10000);

    return true;
  } catch (err) {
    console.error('Browser notification error:', err);
    return false;
  }
}

export async function sendTelegramAlert(
  rule: TriggerRule,
  coin: CryptoCoin,
  timeframeStr: string = '24ч',
  thresholdTriggered?: string
): Promise<{ success: boolean; error?: string }> {
  if (!rule.telegramBotToken || !rule.telegramChatId) {
    return { success: false, error: 'Не указан Bot Token или Chat ID' };
  }

  try {
    const res = await fetch('/api/notify/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: rule.telegramBotToken.trim(),
        chatId: rule.telegramChatId.trim(),
        symbol: coin.symbol,
        name: coin.name,
        dropPercent: coin.change24h,
        currentPrice: coin.priceUsd,
        timeFrame: timeframeStr,
        exchange: coin.source,
        thresholdTriggered: thresholdTriggered || `${rule.minDrop}%`,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Ошибка сети' };
  }
}

export async function sendHourlyDigestToTelegram(
  rule: TriggerRule,
  droppedCoins: { symbol: string; dropPercent: number; price: number }[],
  periodLabel: string = 'За последний 1 час'
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!rule.telegramBotToken || !rule.telegramChatId) {
    return { success: false, error: 'Не указан Bot Token или Chat ID' };
  }

  try {
    const res = await fetch('/api/notify/hourly-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: rule.telegramBotToken.trim(),
        chatId: rule.telegramChatId.trim(),
        drops: droppedCoins,
        periodLabel,
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Ошибка сети' };
  }
}

// Memory map of recently alerted coins to prevent spamming
const recentAlertsTimestamps = new Map<string, { timestamp: number; drop: number }>();

export interface AlertTriggerCheck {
  trigger: boolean;
  thresholdTriggered?: string;
  dropMagnitude: number;
}

export function shouldTriggerAlert(coin: CryptoCoin, rule: TriggerRule): AlertTriggerCheck {
  // Check if user enabled "Only Tracked Coins (up to 10)" mode
  const trackedItem = rule.trackedCoins?.find(
    (tc) => tc.id.toLowerCase() === coin.id.toLowerCase() || tc.symbol.toUpperCase() === coin.symbol.toUpperCase()
  );

  if (rule.onlyTrackedCoins && !trackedItem) {
    return { trigger: false, dropMagnitude: 0 };
  }

  // Check volume threshold
  if (rule.minVolumeUsd && coin.volume24h < rule.minVolumeUsd) {
    return { trigger: false, dropMagnitude: 0 };
  }

  // Calculate change for the active timeframe (1h or 24h)
  const is1h = rule.timeframe === '1h';
  const rawChange = is1h
    ? (coin.change1h !== undefined ? coin.change1h : coin.change24h)
    : coin.change24h;

  const dropMagnitude = rawChange < 0 ? Math.abs(rawChange) : 0;
  let matches = false;
  let thresholdLabel = '';

  const tfSuffix = is1h ? 'за 1 час' : 'за 24ч';

  // Check custom individual per-coin threshold if set
  if (trackedItem && trackedItem.targetDropPercent > 0) {
    if (dropMagnitude >= trackedItem.targetDropPercent) {
      matches = true;
      thresholdLabel = `Персональный: -${trackedItem.targetDropPercent}% (${tfSuffix})`;
    }
  } else if (rule.dropMode === 'exact') {
    // Exact threshold (e.g. drop >= 5%, >= 10%, >= 15%, >= 20%)
    if (dropMagnitude >= rule.exactDropPercent) {
      matches = true;
      thresholdLabel = `Точный порог: -${rule.exactDropPercent}% (${tfSuffix})`;
    }
  } else {
    // Range mode (e.g. 5% to 20% or 10% to 20%)
    if (dropMagnitude >= rule.minDrop && (!rule.maxDrop || dropMagnitude <= rule.maxDrop)) {
      matches = true;
      thresholdLabel = `Диапазон: -${rule.minDrop}%..-${rule.maxDrop || 100}% (${tfSuffix})`;
    }
  }

  if (!matches) {
    return { trigger: false, dropMagnitude };
  }

  const existing = recentAlertsTimestamps.get(`${coin.id}_${rule.timeframe}`);
  const now = Date.now();

  // If alerted in last 10 minutes with roughly the same drop, don't spam
  if (existing && now - existing.timestamp < 10 * 60 * 1000) {
    if (dropMagnitude <= existing.drop + 1.2) {
      return { trigger: false, dropMagnitude };
    }
  }

  recentAlertsTimestamps.set(`${coin.id}_${rule.timeframe}`, { timestamp: now, drop: dropMagnitude });
  return { trigger: true, thresholdTriggered: thresholdLabel, dropMagnitude };
}

export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.00001) return `$${price.toFixed(8)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 10) return `$${price.toFixed(3)}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatVolume(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)} млрд`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)} млн`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}
