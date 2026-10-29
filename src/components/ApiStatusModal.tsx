import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, XCircle, RefreshCw, Zap, ShieldAlert, ExternalLink } from 'lucide-react';
import { ProviderHealth } from '../types/crypto';

export const ApiStatusModal: React.FC<{
  cmcApiKey?: string;
  tokenInsightApiKey?: string;
  onOpenSettings?: () => void;
}> = ({ cmcApiKey, tokenInsightApiKey, onOpenSettings }) => {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [systemTime, setSystemTime] = useState<string>('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const keyToUse = cmcApiKey || (() => {
        try {
          const ruleStr = localStorage.getItem('cryptodrop_rule_v3');
          if (ruleStr) return JSON.parse(ruleStr).cmcApiKey;
        } catch {}
        return '';
      })();

      const tiKeyToUse = tokenInsightApiKey || (() => {
        try {
          const ruleStr = localStorage.getItem('cryptodrop_rule_v3');
          if (ruleStr) return JSON.parse(ruleStr).tokenInsightApiKey;
        } catch {}
        return '';
      })();

      const params = new URLSearchParams();
      if (keyToUse) params.set('cmcApiKey', keyToUse);
      if (tiKeyToUse) params.set('tokenInsightApiKey', tiKeyToUse);
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/crypto/status${query}`);
      const data = await res.json();
      if (data.providers) {
        setProviders(data.providers);
      }
      if (data.systemTime) {
        setSystemTime(data.systemTime);
      }
    } catch (err) {
      console.error('Failed to fetch provider health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [cmcApiKey, tokenInsightApiKey]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Статус бесплатных открытых API и бирж</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Приложение агрегирует бесплатные открытые API бирж (Binance, Bybit, OKX, Bitget, MEXC), CoinGecko, CoinMarketCap и TokenInsight API.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Проверить пинг</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p, idx) => {
          const isCmc = p.exchangeId === 'coinmarketcap';
          const isTi = p.exchangeId === 'tokeninsight';
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg flex flex-col justify-between space-y-3 border transition-colors ${
                isCmc
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : isTi
                  ? 'bg-sky-950/20 border-sky-500/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    {p.online ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{(isCmc || isTi) && p.keyConfigured ? 'Активен' : 'Онлайн'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Офлайн</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{p.note}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono-numbers text-slate-300 font-semibold">
                    {p.latencyMs} мс
                  </span>
                  <div className="text-[10px] text-emerald-400 font-medium">Бесплатный</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Zap className={`w-3 h-3 ${isCmc ? 'text-amber-400' : isTi ? 'text-sky-400' : 'text-slate-400'}`} />
                  {isCmc ? (
                    p.keyConfigured ? (
                      <span className="text-amber-300 font-medium">Free Key подключен</span>
                    ) : (
                      <span className="text-slate-500">Ключ не указан</span>
                    )
                  ) : isTi ? (
                    p.keyConfigured ? (
                      <span className="text-sky-300 font-medium">TI_API_KEY подключен</span>
                    ) : (
                      <span className="text-slate-500">Ключ не указан (в Настройках)</span>
                    )
                  ) : (
                    <span>Ключ API: не требуется</span>
                  )}
                </span>
                <span>Код HTTP: {p.status || 'OK'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* API Reference Guide */}
      <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-2">
        <div className="font-semibold text-slate-200">Особенности источников котировок в приложении:</div>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>TokenInsight Open API:</strong> Извлечение официального рейтинга Top Losers 24H и рейтингов активов инвестиционных фондов по ключу <code className="text-sky-300">TI_API_KEY</code>.</li>
          <li><strong>CoinMarketCap Free API:</strong> Официальный каталог Топ-500 монет с актуальными 1ч/24ч/7d процентами изменений (10 000 бесплатных кредитов в месяц). Запросы кэшируются на 60 сек.</li>
          <li><strong>Binance Spot API:</strong> Высокоскоростной спотовый поток цен для всех пар к USDT (~500+ пар), отсортированных по объёму торгов.</li>
          <li><strong>Bybit Spot V5:</strong> Публичный поток тикеров Bybit для мгновенного подтверждения котировок без API-ключа.</li>
          <li><strong>OKX, Bitget, MEXC API:</strong> Открытые endpoints спотовых цен для расширения покрытия альткоинов и выявления максимальных просадок.</li>
          <li><strong>CoinGecko Free API:</strong> Предоставляет глубокую динамику капитализации и sparklines без обязательной авторизации.</li>
        </ul>
      </div>
    </div>
  );
};
