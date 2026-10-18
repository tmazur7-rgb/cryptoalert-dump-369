import React from 'react';
import { Trash2, CheckCircle2, Download, Bell, ExternalLink, Send } from 'lucide-react';
import { TriggeredAlert, TriggerRule, CryptoCoin } from '../types/crypto';
import { formatPrice } from '../utils/notifications';

interface TriggeredAlertsDrawerProps {
  alerts: TriggeredAlert[];
  onMarkAllAsRead: () => void;
  onClearAlerts: () => void;
  onResendTelegram: (alert: TriggeredAlert) => void;
  rule: TriggerRule;
}

export const TriggeredAlertsDrawer: React.FC<TriggeredAlertsDrawerProps> = ({
  alerts,
  onMarkAllAsRead,
  onClearAlerts,
  onResendTelegram,
  rule,
}) => {
  const exportToCsv = () => {
    if (alerts.length === 0) return;
    const headers = ['Время', 'Символ', 'Название', 'Падение %', 'Цена USD', 'Источник'];
    const rows = alerts.map((a) => [
      new Date(a.timestamp).toLocaleString('ru-RU'),
      a.symbol,
      `"${a.name.replace(/"/g, '""')}"`,
      `-${Math.abs(a.dropPercent).toFixed(2)}%`,
      a.price,
      a.source,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crypto_drop_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-4">
      {/* Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose-500" />
            <span>Журнал зафиксированных падений</span>
            <span className="text-xs font-mono-numbers px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {alerts.length} событий
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            История монет из Топ-500, упавших на 10-20% или более во время работы монитора
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Прочитано ({unreadCount})</span>
            </button>
          )}

          <button
            onClick={exportToCsv}
            disabled={alerts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт CSV</span>
          </button>

          <button
            onClick={onClearAlerts}
            disabled={alerts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-40 rounded-lg transition-colors border border-rose-900/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Очистить</span>
          </button>
        </div>
      </div>

      {/* Alert Feed Items */}
      {alerts.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <Bell className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">Журнал алертов пока пуст</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Как только монитор зафиксирует монету с падением в диапазоне 10-20% (или по вашему правилу),
            здесь появится уведомление, прозвучит сигнал и сработает оповещение.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const date = new Date(alert.timestamp);
            const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = date.toLocaleDateString('ru-RU');
            const drop = Math.abs(alert.dropPercent);

            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-lg border transition-colors flex items-center justify-between gap-4 ${
                  !alert.read
                    ? 'bg-rose-950/20 border-rose-800/40'
                    : 'bg-slate-900/60 border-slate-800/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono-numbers font-bold text-rose-400">
                      -{drop.toFixed(1)}%
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{alert.symbol}</span>
                      <span className="text-xs text-slate-400 truncate max-w-[140px]">{alert.name}</span>
                      {!alert.read && (
                        <span className="text-[10px] text-rose-400 font-semibold px-1.5 py-0.2 rounded bg-rose-900/40">
                          Новый
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>Цена: <strong className="text-slate-300 font-mono-numbers">{formatPrice(alert.price)}</strong></span>
                      <span>·</span>
                      <span>{alert.source}</span>
                      <span>·</span>
                      <span className="font-mono-numbers">{dateStr} {timeStr}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rule.telegramBotToken && rule.telegramChatId && (
                    <button
                      onClick={() => onResendTelegram(alert)}
                      title="Отправить это оповещение в Telegram"
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">В Telegram</span>
                    </button>
                  )}

                  <a
                    href={`https://www.tradingview.com/chart/?symbol=BINANCE:${alert.symbol}USDT`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    title="График TradingView"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
