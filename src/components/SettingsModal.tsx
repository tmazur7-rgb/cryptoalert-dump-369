import React, { useState } from 'react';
import {
  Settings,
  Volume2,
  Bell,
  Send,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Building2,
  Sliders,
  Target,
  Trash2,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Check,
} from 'lucide-react';
import { TriggerRule, SoundType, SupportedExchange, CmcKeyStatus, TokenInsightKeyStatus } from '../types/crypto';
import { playAlertSound } from '../utils/audio';
import { requestBrowserNotificationPermission, sendBrowserNotification } from '../utils/notifications';

interface SettingsModalProps {
  rule: TriggerRule;
  setRule: React.Dispatch<React.SetStateAction<TriggerRule>>;
  notificationPermission: NotificationPermission;
  setNotificationPermission: (p: NotificationPermission) => void;
}

const ALL_EXCHANGES: { id: SupportedExchange; name: string }[] = [
  { id: 'binance', name: 'Binance' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'okx', name: 'OKX' },
  { id: 'bitget', name: 'Bitget' },
  { id: 'mexc', name: 'MEXC' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  rule,
  setRule,
  notificationPermission,
  setNotificationPermission,
}) => {
  const [testTgStatus, setTestTgStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({
    loading: false,
  });
  const [showTgGuide, setShowTgGuide] = useState<boolean>(false);
  const [showCmcKey, setShowCmcKey] = useState<boolean>(false);
  const [cmcTestStatus, setCmcTestStatus] = useState<{
    loading: boolean;
    status?: CmcKeyStatus;
  }>({ loading: false });

  const [showTiKey, setShowTiKey] = useState<boolean>(false);
  const [tiTestStatus, setTiTestStatus] = useState<{
    loading: boolean;
    status?: TokenInsightKeyStatus;
  }>({ loading: false });

  const handleTestTiKey = async () => {
    const rawKey = rule.tokenInsightApiKey?.trim();
    if (!rawKey) {
      setTiTestStatus({
        loading: false,
        status: { valid: false, error: 'Введите ваш API-ключ TokenInsight (TI_API_KEY)' },
      });
      return;
    }

    setTiTestStatus({ loading: true });
    try {
      const res = await fetch('/api/crypto/tokeninsight/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rawKey }),
      });
      const data = await res.json();
      if (data.success && data.valid) {
        setTiTestStatus({
          loading: false,
          status: {
            valid: true,
            planName: data.planName || 'Open API',
            rateLimitMinute: data.rateLimitMinute || 60,
            checkedAt: new Date().toLocaleTimeString('ru-RU'),
          },
        });
        setRule((prev) => ({ ...prev, useTokenInsight: true }));
      } else {
        setTiTestStatus({
          loading: false,
          status: {
            valid: false,
            error: data.error || 'Недействительный API-ключ TokenInsight',
          },
        });
      }
    } catch (err: any) {
      setTiTestStatus({
        loading: false,
        status: {
          valid: false,
          error: err.message || 'Ошибка подключения к TokenInsight API',
        },
      });
    }
  };

  const handleTestCmcKey = async () => {
    const rawKey = rule.cmcApiKey?.trim();
    if (!rawKey) {
      setCmcTestStatus({
        loading: false,
        status: { valid: false, error: 'Введите ваш бесплатный API-ключ CoinMarketCap' },
      });
      return;
    }

    setCmcTestStatus({ loading: true });
    try {
      const res = await fetch('/api/crypto/cmc/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rawKey }),
      });
      const data = await res.json();
      if (data.success && data.valid) {
        setCmcTestStatus({
          loading: false,
          status: {
            valid: true,
            planName: data.planName,
            creditLimitMonthly: data.creditLimitMonthly,
            creditsLeftDay: data.creditsLeftDay,
            creditsUsedDay: data.creditsUsedDay,
            creditsLeftMonth: data.creditsLeftMonth,
            creditsUsedMonth: data.creditsUsedMonth,
            rateLimitMinute: data.rateLimitMinute,
            checkedAt: new Date().toLocaleTimeString('ru-RU'),
          },
        });
        setRule((prev) => ({ ...prev, useCmcCatalog: true }));
      } else {
        setCmcTestStatus({
          loading: false,
          status: {
            valid: false,
            error: data.error || 'Недействительный API-ключ CoinMarketCap',
          },
        });
      }
    } catch (err: any) {
      setCmcTestStatus({
        loading: false,
        status: {
          valid: false,
          error: err.message || 'Ошибка подключения к серверу проверки CMC',
        },
      });
    }
  };

  const handleSoundTest = () => {
    playAlertSound(rule.soundType, 0.8);
  };

  const handleBrowserNotifTest = async () => {
    let perm = notificationPermission;
    if (perm !== 'granted') {
      perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
    }
    if (perm === 'granted') {
      sendBrowserNotification(
        `🚨 ТЕСТ АЛЕРТА: BTC упал на -${rule.exactDropPercent || 15}%!`,
        `Тестовое системное уведомление от CryptoDrop Alert для выбранных бирж (${rule.selectedExchanges.map(e => e.toUpperCase()).join(', ')}).`
      );
      playAlertSound(rule.soundType);
    } else {
      alert('Уведомления заблокированы в браузере. Разрешите их в настройках сайта в адресной строке.');
    }
  };

  const handleToggleExchange = (ex: SupportedExchange) => {
    setRule((prev) => {
      const exists = prev.selectedExchanges.includes(ex);
      if (exists) {
        if (prev.selectedExchanges.length === 1) return prev; // Keep at least one
        return { ...prev, selectedExchanges: prev.selectedExchanges.filter((e) => e !== ex) };
      } else {
        return { ...prev, selectedExchanges: [...prev.selectedExchanges, ex] };
      }
    });
  };

  const handleTestTelegram = async () => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      setTestTgStatus({ loading: false, success: false, msg: 'Заполните Bot Token и Chat ID' });
      return;
    }

    setTestTgStatus({ loading: true });
    try {
      const res = await fetch('/api/notify/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: rule.telegramBotToken.trim(),
          chatId: rule.telegramChatId.trim(),
          symbol: 'SOL',
          name: 'Solana',
          dropPercent: -(rule.exactDropPercent || 15),
          currentPrice: 165.4,
          timeFrame: '24 часа',
          exchange: rule.selectedExchanges.map(e => e.toUpperCase()).join(', '),
          thresholdTriggered: `${rule.exactDropPercent || 15}%`,
          customText: `🚨 <b>ТЕСТОВОЕ ОПОВЕЩЕНИЕ КРИПТО ДРОП</b> 📉\n\n` +
            `Монитор настроен успешно!\n` +
            `🎯 <b>Порог падения:</b> -${rule.exactDropPercent || 15}%\n` +
            `🏛 <b>Выбранные биржи:</b> ${rule.selectedExchanges.map(e => e.toUpperCase()).join(', ')}\n` +
            `🪙 <b>Отслеживаемых монет в списке:</b> ${rule.trackedCoins.length}/10\n\n` +
            `⏰ Время: ${new Date().toLocaleTimeString('ru-RU')}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestTgStatus({ loading: false, success: true, msg: 'Тестовое сообщение успешно доставлено в Telegram!' });
      } else {
        setTestTgStatus({ loading: false, success: false, msg: data.error || 'Ошибка отправки в Telegram' });
      }
    } catch (err: any) {
      setTestTgStatus({ loading: false, success: false, msg: err.message || 'Ошибка сети' });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-rose-500" />
          <span>Настройки бирж, точного порога и оповещений</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Выберите биржи (Binance, Bybit, OKX, Bitget, MEXC), подключите CoinMarketCap API ключ, задайте точный процент падения (10%, 15%, 20%) и настройте список до 10 монет.
        </p>
      </div>

      {/* CoinMarketCap API Integration Card */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs tracking-tighter">
              CMC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">CoinMarketCap API (Бесплатный Free Key)</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {rule.cmcApiKey ? 'Ключ добавлен' : 'Free Tier'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Используйте ваш бесплатный API-ключ CoinMarketCap для загрузки официального рейтинга Топ-500 и точных данных о просадках
              </p>
            </div>
          </div>

          <a
            href="https://coinmarketcap.com/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 hover:underline transition-colors font-medium"
          >
            <span>Получить ключ на coinmarketcap.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Ваш API-ключ CoinMarketCap (X-CMC_PRO_API_KEY):</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showCmcKey ? 'text' : 'password'}
                placeholder="например: b54bcf4d-1bca-4e41-96b0-bb62646d32f0"
                value={rule.cmcApiKey || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setRule((prev) => ({ ...prev, cmcApiKey: val }));
                  if (cmcTestStatus.status) setCmcTestStatus({ loading: false });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs text-white font-mono-numbers focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCmcKey(!showCmcKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                title={showCmcKey ? 'Скрыть ключ' : 'Показать ключ'}
              >
                {showCmcKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestCmcKey}
              disabled={cmcTestStatus.loading || !rule.cmcApiKey?.trim()}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
            >
              {cmcTestStatus.loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Проверка лимитов...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Проверить ключ и лимиты</span>
                </>
              )}
            </button>
          </div>

          {/* Validation Result Display */}
          {cmcTestStatus.status?.valid && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 space-y-2 text-xs text-emerald-200">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>API-ключ действителен! Тариф: {cmcTestStatus.status.planName}</span>
                </span>
                <span className="text-[11px] text-emerald-300/80 font-mono-numbers">
                  Проверено в {cmcTestStatus.status.checkedAt}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono-numbers text-[11px]">
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Осталось сегодня:</span>
                  <span className="text-emerald-300 font-bold">{cmcTestStatus.status.creditsLeftDay ?? 333} кредитов</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Осталось в месяц:</span>
                  <span className="text-emerald-300 font-bold">{cmcTestStatus.status.creditsLeftMonth ?? 10000}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Лимит в минуту:</span>
                  <span className="text-white font-bold">{cmcTestStatus.status.rateLimitMinute ?? 30} req/m</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Защита лимитов:</span>
                  <span className="text-amber-400 font-bold">Кэш 60 сек</span>
                </div>
              </div>
            </div>
          )}

          {cmcTestStatus.status && !cmcTestStatus.status.valid && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Ошибка валидации ключа CoinMarketCap:</span>
                <span>{cmcTestStatus.status.error}</span>
                <p className="mt-1 text-[11px] text-rose-400/80">
                  Убедитесь, что скопировали ключ полностью без лишних пробелов из раздела API Key в кабинете CoinMarketCap.
                </p>
              </div>
            </div>
          )}

          {/* Toggle to use CMC as primary catalog */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={rule.useCmcCatalog !== false && Boolean(rule.cmcApiKey?.trim())}
                onChange={(e) => setRule((prev) => ({ ...prev, useCmcCatalog: e.target.checked }))}
                disabled={!rule.cmcApiKey?.trim()}
                className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800 focus:ring-amber-500 disabled:opacity-40"
              />
              <span className={rule.cmcApiKey?.trim() ? 'text-white font-medium' : 'text-slate-500'}>
                Использовать CoinMarketCap в качестве основного каталога Топ-500
              </span>
            </label>

            <span className="text-[11px] text-slate-400">
              Бесплатно 10 000 кредитов/месяц (~333 запроса в день)
            </span>
          </div>
        </div>
      </div>

      {/* TokenInsight API Key Configuration */}
      <div className="bg-slate-900/60 border border-sky-500/30 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs tracking-tighter">
              TI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">TokenInsight API (TI_API_KEY)</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {rule.tokenInsightApiKey ? 'Ключ добавлен' : 'Open API'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Используйте ваш API-ключ TokenInsight для прямого извлечения официального списка Top Losers 24H, рейтингов фондовых монет (AAA, AA, A) и институциональных портфелей
              </p>
            </div>
          </div>

          <a
            href="https://tokeninsight.com/en/cryptocurrencies/gainers-losers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline transition-colors font-medium"
          >
            <span>Страница Losers на TokenInsight</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-sky-400" />
            <span>Ваш API-ключ TokenInsight (заголовок TI_API_KEY):</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showTiKey ? 'text' : 'password'}
                placeholder="Вставьте ваш TI_API_KEY (например, ti_live_xxxxxxxxxx)"
                value={rule.tokenInsightApiKey || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setRule((prev) => ({ ...prev, tokenInsightApiKey: val }));
                  if (tiTestStatus.status) setTiTestStatus({ loading: false });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowTiKey(!showTiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                title={showTiKey ? 'Скрыть ключ' : 'Показать ключ'}
              >
                {showTiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestTiKey}
              disabled={tiTestStatus.loading || !rule.tokenInsightApiKey?.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              {tiTestStatus.loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Проверить ключ TokenInsight</span>
                </>
              )}
            </button>
          </div>

          {/* Test Status feedback */}
          {tiTestStatus.status && tiTestStatus.status.valid && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>API-ключ TokenInsight валиден и готов к работе!</span>
                <span className="text-[11px] text-slate-400 ml-auto font-normal">
                  Проверено: {tiTestStatus.status.checkedAt}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Тариф / Доступ:</span>
                  <span className="text-white font-bold">{tiTestStatus.status.planName}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Лимит запросов:</span>
                  <span className="text-white font-bold">{tiTestStatus.status.rateLimitMinute ?? 60} req/m</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                  <span className="text-slate-400 block text-[10px]">Кэширование API:</span>
                  <span className="text-sky-400 font-bold">Серверный кэш 30 сек</span>
                </div>
              </div>
            </div>
          )}

          {tiTestStatus.status && !tiTestStatus.status.valid && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Ошибка валидации ключа TokenInsight:</span>
                <span>{tiTestStatus.status.error}</span>
                <p className="mt-1 text-[11px] text-rose-400/80">
                  Убедитесь, что скопировали ключ из личного кабинета TokenInsight API и вставили без лишних пробелов.
                </p>
              </div>
            </div>
          )}

          {/* Toggle to use TokenInsight */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={rule.useTokenInsight !== false && Boolean(rule.tokenInsightApiKey?.trim())}
                onChange={(e) => setRule((prev) => ({ ...prev, useTokenInsight: e.target.checked }))}
                disabled={!rule.tokenInsightApiKey?.trim()}
                className="w-4 h-4 rounded text-sky-500 bg-slate-950 border-slate-800 focus:ring-sky-500 disabled:opacity-40"
              />
              <span className={rule.tokenInsightApiKey?.trim() ? 'text-white font-medium' : 'text-slate-500'}>
                Активировать извлечение Top Losers 24H и рейтингов через TokenInsight API
              </span>
            </label>

            <span className="text-[11px] text-slate-400">
              Лимит: 60 запросов/мин (применяется серверный кэш)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Exchange Selection & Calculation Mode */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-2">
            <Building2 className="w-4 h-4 text-sky-400" />
            <span>Предпочтительные биржи (Binance, Bybit, OKX, Bitget, MEXC)</span>
          </div>

          <p className="text-xs text-slate-400">
            Данные с выбранных бирж используются для расчёта падения цен и отправки уведомлений:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_EXCHANGES.map((ex) => {
              const isSelected = rule.selectedExchanges.includes(ex.id);
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleToggleExchange(ex.id)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{ex.name}</span>
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-rose-500' : 'bg-slate-700'}`} />
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              Режим расчёта падения по выбранным биржам:
            </label>
            <select
              value={rule.exchangeAggregationMode}
              onChange={(e) => setRule((prev) => ({ ...prev, exchangeAggregationMode: e.target.value as any }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="any">Максимальное падение (триггер при дампе на любой выбранной бирже)</option>
              <option value="average">Средняя цена по всем выбранным биржам (усреднение)</option>
              <option value="first">Первая доступная биржа в списке приоритета</option>
            </select>
          </div>
        </div>

        {/* Section 2: Exact Drop Percentage Configuration */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-2">
            <Sliders className="w-4 h-4 text-rose-400" />
            <span>Настройка точного процента падения</span>
          </div>

          <div>
            <span className="text-xs text-slate-300 font-medium block mb-2">
              Быстрый выбор порога:
            </span>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[5, 10, 15, 20].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() =>
                    setRule((prev) => ({
                      ...prev,
                      dropMode: 'exact',
                      exactDropPercent: val,
                      minDrop: val,
                    }))
                  }
                  className={`py-2 px-2 text-xs font-bold rounded-lg border font-mono-numbers transition-colors ${
                    rule.dropMode === 'exact' && rule.exactDropPercent === val
                      ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  -{val}%
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setRule((prev) => ({ ...prev, dropMode: 'range', minDrop: 5, maxDrop: 20 }))}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-colors ${
                  rule.dropMode === 'range' && rule.minDrop === 5 && rule.maxDrop === 20
                    ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Диапазон: 5%–20%
              </button>

              <button
                type="button"
                onClick={() => setRule((prev) => ({ ...prev, dropMode: 'range', minDrop: 10, maxDrop: 20 }))}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-colors ${
                  rule.dropMode === 'range' && rule.minDrop === 10 && rule.maxDrop === 20
                    ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📉 Диапазон: 10%–20%
              </button>
            </div>

            <div className="mb-3">
              <span className="text-xs text-slate-300 font-medium block mb-1">
                Период расчёта падения (таймфрейм):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRule((prev) => ({ ...prev, timeframe: '1h' }))}
                  className={`py-1.5 px-2 text-xs font-semibold rounded border transition-colors ${
                    rule.timeframe === '1h'
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ⏱ 1 час (Flash-дамп за 60 мин)
                </button>
                <button
                  type="button"
                  onClick={() => setRule((prev) => ({ ...prev, timeframe: '24h' }))}
                  className={`py-1.5 px-2 text-xs font-semibold rounded border transition-colors ${
                    rule.timeframe === '24h'
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  📅 24 часа (Суточное падение)
                </button>
              </div>
            </div>

            <label className="text-xs text-slate-300 font-medium block mb-1">
              Или введите точный процент вручную (%):
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="95"
                step="0.5"
                value={rule.exactDropPercent}
                onChange={(e) =>
                  setRule((prev) => ({
                    ...prev,
                    dropMode: 'exact',
                    exactDropPercent: Number(e.target.value),
                    minDrop: Number(e.target.value),
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono-numbers focus:border-rose-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono-numbers">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Уведомление сработает, когда падение цены за 24ч на выбранных биржах достигнет или превысит этот процент.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Tracked Coins Basket (Up to 10 coins) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Персональный список отслеживания (до 10 монет из Топ-500)</span>
          </div>
          <span className="text-xs font-mono-numbers px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold">
            {rule.trackedCoins.length} / 10
          </span>
        </div>

        {rule.trackedCoins.length === 0 ? (
          <p className="text-xs text-slate-400">
            В списке пока нет монет. Вы можете добавить до 10 монет из таблицы во вкладке «Монитор рынка».
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {rule.trackedCoins.map((tc) => (
              <div
                key={tc.id}
                className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{tc.symbol}</span>
                  <button
                    onClick={() =>
                      setRule((prev) => ({
                        ...prev,
                        trackedCoins: prev.trackedCoins.filter((c) => c.id !== tc.id),
                      }))
                    }
                    className="text-slate-500 hover:text-rose-400 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Порог:</span>
                  <select
                    value={tc.targetDropPercent || 15}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRule((prev) => ({
                        ...prev,
                        trackedCoins: prev.trackedCoins.map((c) =>
                          c.id === tc.id ? { ...c, targetDropPercent: val } : c
                        ),
                      }));
                    }}
                    className="bg-slate-900 border border-slate-800 text-rose-400 font-mono-numbers font-bold rounded px-1 text-[11px]"
                  >
                    <option value={10}>-10%</option>
                    <option value={12}>-12%</option>
                    <option value={15}>-15%</option>
                    <option value={18}>-18%</option>
                    <option value={20}>-20%</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Sound, Push & Telegram Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sound & Browser */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-2">
            <Bell className="w-4 h-4 text-sky-400" />
            <span>Звук и системные оповещения</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span>Звуковой сигнал</span>
              </label>
              <input
                type="checkbox"
                checked={rule.soundEnabled}
                onChange={(e) => setRule((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
                className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-800 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rule.soundType}
                disabled={!rule.soundEnabled}
                onChange={(e) => setRule((prev) => ({ ...prev, soundType: e.target.value as SoundType }))}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                <option value="chime">Двойной колокол (Chime Drop)</option>
                <option value="pulse">Техно-пульс (Double Pulse)</option>
                <option value="sonar">Сонар тревоги (Urgent Sonar)</option>
              </select>

              <button
                type="button"
                onClick={handleSoundTest}
                disabled={!rule.soundEnabled}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-40 whitespace-nowrap"
              >
                Тест звука
              </button>
            </div>

            <button
              type="button"
              onClick={handleBrowserNotifTest}
              className="w-full py-2 px-3 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors mt-2"
            >
              Отправить тестовый системный пуш в браузер
            </button>
          </div>
        </div>

        {/* Telegram */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Telegram Bot (Бесплатно)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowTgGuide(!showTgGuide)}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              {showTgGuide ? 'Скрыть' : 'Инструкция'}
            </button>
          </div>

          {showTgGuide && (
            <p className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-800">
              1. Создайте бота в @BotFather, скопируйте токен. 2. Нажмите Start в боте. 3. Узнайте свой Chat ID в @userinfobot и вставьте ниже.
            </p>
          )}

          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Telegram Bot Token:</label>
            <input
              type="text"
              placeholder="123456789:ABCdefGh..."
              value={rule.telegramBotToken}
              onChange={(e) => setRule((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Chat ID пользователя или канала:</label>
            <input
              type="text"
              placeholder="Например: 987654321"
              value={rule.telegramChatId}
              onChange={(e) => setRule((prev) => ({ ...prev, telegramChatId: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.telegramEnabled}
                  onChange={(e) => setRule((prev) => ({ ...prev, telegramEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-sky-600 bg-slate-950 border-slate-800"
                />
                <span>Включить мгновенные алерты в TG</span>
              </label>

              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testTgStatus.loading || !rule.telegramBotToken || !rule.telegramChatId}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded transition-colors"
              >
                {testTgStatus.loading ? 'Отправка...' : 'Тест TG'}
              </button>
            </div>

            <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer pt-1 border-t border-slate-800/60">
              <input
                type="checkbox"
                checked={rule.hourlyDigestEnabled}
                onChange={(e) => setRule((prev) => ({ ...prev, hourlyDigestEnabled: e.target.checked }))}
                className="w-4 h-4 rounded text-sky-600 bg-slate-950 border-slate-800"
              />
              <span className="text-sky-300 font-medium">Почасовой дайджест: каждый час отправлять сводку монет с падением 5–20%</span>
            </label>
          </div>

          {testTgStatus.msg && (
            <div
              className={`p-2 rounded text-xs flex items-center gap-2 ${
                testTgStatus.success
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
              }`}
            >
              {testTgStatus.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{testTgStatus.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
