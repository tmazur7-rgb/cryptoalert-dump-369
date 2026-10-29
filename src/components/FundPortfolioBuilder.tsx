import React, { useState, useMemo } from 'react';
import {
  CryptoCoin,
  TriggerRule,
  FundInvestmentCoin,
  CryptoFund,
} from '../types/crypto';
import { CRYPTO_FUNDS, FUND_INVESTMENT_COINS } from '../data/fundPortfolios';
import {
  Briefcase,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Building,
  CheckCircle2,
  CircleDot,
  DollarSign,
  PieChart,
  Send,
  Sliders,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Copy,
  Check,
  Search,
  Filter,
} from 'lucide-react';

interface FundPortfolioBuilderProps {
  coins: CryptoCoin[];
  rule: TriggerRule;
  onAddTrackedCoin: (coin: { id: string; symbol: string; name: string; priceUsd: number }) => void;
  onAddMultipleTrackedCoins: (coinsList: { id: string; symbol: string; name: string; priceUsd: number }[]) => void;
  trackedCoinSymbols: Set<string>;
}

export const FundPortfolioBuilder: React.FC<FundPortfolioBuilderProps> = ({
  coins,
  rule,
  onAddTrackedCoin,
  onAddMultipleTrackedCoins,
  trackedCoinSymbols,
}) => {
  // Fund selection state (default all enabled)
  const [selectedFundIds, setSelectedFundIds] = useState<Set<string>>(
    () => new Set(CRYPTO_FUNDS.map((f) => f.id))
  );

  // Filters
  const [minOverlap, setMinOverlap] = useState<number>(2); // Default to >= 2 intersecting funds
  const [tierFilter, setTierFilter] = useState<'all' | 'tier1'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Portfolio Assembly State
  const [selectedCoinSymbols, setSelectedCoinSymbols] = useState<Set<string>>(() => {
    // Default select top overlapping coins with >= 3 funds
    return new Set(
      FUND_INVESTMENT_COINS.filter((c) => c.funds.length >= 3).map((c) => c.symbol)
    );
  });

  const [investmentBudget, setInvestmentBudget] = useState<number>(5000);
  const [weightStrategy, setWeightStrategy] = useState<'consensus' | 'equal'>('consensus');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [telegramSending, setTelegramSending] = useState<boolean>(false);
  const [telegramSuccess, setTelegramSuccess] = useState<boolean>(false);

  // Map of live prices and metrics by uppercase symbol
  const liveCoinMap = useMemo(() => {
    const map = new Map<string, CryptoCoin>();
    for (const c of coins) {
      map.set(c.symbol.toUpperCase(), c);
    }
    return map;
  }, [coins]);

  // Merge fund investment coins with live pricing
  const enrichedFundCoins: FundInvestmentCoin[] = useMemo(() => {
    return FUND_INVESTMENT_COINS.map((fc) => {
      const live = liveCoinMap.get(fc.symbol.toUpperCase());
      return {
        ...fc,
        priceUsd: live?.priceUsd || 0,
        change24h: live?.change24h || 0,
        change1h: live?.change1h || 0,
        volume24h: live?.volume24h || 0,
        marketCap: live?.marketCap || 0,
        rank: live?.rank,
      };
    });
  }, [liveCoinMap]);

  // Funds map for fast lookup
  const fundsMap = useMemo(() => {
    const map = new Map<string, CryptoFund>();
    for (const f of CRYPTO_FUNDS) {
      map.set(f.id, f);
    }
    return map;
  }, []);

  // Filtered coins based on active selections
  const filteredCoins = useMemo(() => {
    return enrichedFundCoins
      .map((coin) => {
        // Count how many of the USER'S selected funds invested in this coin
        const matchedFunds = coin.funds.filter((fId) => selectedFundIds.has(fId));
        return {
          coin,
          matchedFunds,
          matchedCount: matchedFunds.length,
        };
      })
      .filter(({ coin, matchedCount, matchedFunds }) => {
        // Min overlap threshold
        if (matchedCount < minOverlap) return false;

        // Tier filter
        if (tierFilter === 'tier1') {
          const hasTier1 = matchedFunds.some((fId) => fundsMap.get(fId)?.tier === 'tier1');
          if (!hasTier1) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && coin.category !== categoryFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchSym = coin.symbol.toLowerCase().includes(q);
          const matchName = coin.name.toLowerCase().includes(q);
          const matchDesc = coin.description.toLowerCase().includes(q);
          if (!matchSym && !matchName && !matchDesc) return false;
        }

        return true;
      })
      .sort((a, b) => b.matchedCount - a.matchedCount || (b.coin.volume24h || 0) - (a.coin.volume24h || 0));
  }, [enrichedFundCoins, selectedFundIds, minOverlap, tierFilter, categoryFilter, searchQuery, fundsMap]);

  // Preset Handlers
  const applyFundPreset = (
    type:
      | 'circle-coinbase-yzi'
      | 'tier1'
      | 'asian-vcs'
      | 'institutional'
      | 'defi-giants'
      | 'a16z-paradigm'
      | 'all'
  ) => {
    if (type === 'circle-coinbase-yzi') {
      setSelectedFundIds(new Set(['circle-ventures', 'coinbase-ventures', 'yzi-binance-labs']));
      setMinOverlap(2);
      setTierFilter('tier1');
    } else if (type === 'tier1') {
      const tier1Ids = CRYPTO_FUNDS.filter((f) => f.tier === 'tier1').map((f) => f.id);
      setSelectedFundIds(new Set(tier1Ids));
      setMinOverlap(2);
      setTierFilter('tier1');
    } else if (type === 'asian-vcs') {
      setSelectedFundIds(
        new Set([
          'hashkey-capital',
          'fenbushi-capital',
          'spartan-group',
          'snz-holding',
          'yzi-binance-labs',
        ])
      );
      setMinOverlap(2);
      setTierFilter('all');
    } else if (type === 'institutional') {
      setSelectedFundIds(
        new Set([
          'citadel-securities',
          'galaxy-digital',
          'blackstone',
          'dcg',
          'coinbase-ventures',
        ])
      );
      setMinOverlap(2);
      setTierFilter('tier1');
    } else if (type === 'defi-giants') {
      setSelectedFundIds(
        new Set([
          'parafi-capital',
          'defiance-capital',
          'paradigm',
          'a16z-crypto',
          'pantera-capital',
        ])
      );
      setMinOverlap(2);
      setTierFilter('all');
    } else if (type === 'a16z-paradigm') {
      setSelectedFundIds(
        new Set([
          'a16z-crypto',
          'paradigm',
          'coinbase-ventures',
          'polychain-capital',
          'multicoin-capital',
        ])
      );
      setMinOverlap(2);
      setTierFilter('tier1');
    } else {
      setSelectedFundIds(new Set(CRYPTO_FUNDS.map((f) => f.id)));
      setMinOverlap(1);
      setTierFilter('all');
    }
  };

  const selectAllFunds = () => {
    setSelectedFundIds(new Set(CRYPTO_FUNDS.map((f) => f.id)));
  };

  const clearAllFunds = () => {
    setSelectedFundIds(new Set());
  };

  const toggleFund = (fundId: string) => {
    setSelectedFundIds((prev) => {
      const next = new Set(prev);
      if (next.has(fundId)) {
        if (next.size === 1) return prev; // Keep at least one
        next.delete(fundId);
      } else {
        next.add(fundId);
      }
      return next;
    });
  };

  const toggleSelectCoin = (symbol: string) => {
    setSelectedCoinSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedCoinSymbols(new Set(filteredCoins.map((item) => item.coin.symbol)));
  };

  const deselectAll = () => {
    setSelectedCoinSymbols(new Set());
  };

  // Portfolio Weights & Allocations
  const portfolioAllocations = useMemo(() => {
    const selectedList = enrichedFundCoins.filter((c) => selectedCoinSymbols.has(c.symbol));
    if (selectedList.length === 0) return [];

    let totalWeightScore = 0;
    const items = selectedList.map((coin) => {
      // Consensus weight gives more weight to coins backed by more funds
      const weightScore = weightStrategy === 'consensus' ? Math.max(1, coin.funds.length) : 1;
      totalWeightScore += weightScore;
      return { coin, weightScore };
    });

    return items.map(({ coin, weightScore }) => {
      const weightPercent = Math.round((weightScore / totalWeightScore) * 1000) / 10;
      const allocationUsd = Math.round((investmentBudget * (weightScore / totalWeightScore)) * 100) / 100;
      const tokenAmount =
        coin.priceUsd && coin.priceUsd > 0
          ? Math.round((allocationUsd / coin.priceUsd) * 10000) / 10000
          : 0;

      return {
        coin,
        weightPercent,
        allocationUsd,
        tokenAmount,
      };
    });
  }, [enrichedFundCoins, selectedCoinSymbols, weightStrategy, investmentBudget]);

  // Add all selected portfolio coins to tracked basket (max 10 allowed in basket)
  const handleAddAllToMonitoring = () => {
    const toAdd = portfolioAllocations.slice(0, 10).map((item) => ({
      id: item.coin.symbol,
      symbol: item.coin.symbol,
      name: item.coin.name,
      priceUsd: item.coin.priceUsd || 0,
    }));
    onAddMultipleTrackedCoins(toAdd);
  };

  // Copy portfolio text
  const handleCopySummary = () => {
    if (portfolioAllocations.length === 0) return;
    let text = `💼 ПОРТФЕЛЬ ПЕРЕСЕЧЕНИЙ КРИПТОФОНДОВ (Tier 1 / Tier 2)\n`;
    text += `💰 Бюджет: $${investmentBudget.toLocaleString()} | Монет: ${portfolioAllocations.length}\n\n`;

    portfolioAllocations.forEach((item, idx) => {
      const fundsStr = item.coin.funds.map((fId) => fundsMap.get(fId)?.shortName || fId).join(', ');
      text += `${idx + 1}. ${item.coin.symbol} (${item.coin.name})\n`;
      text += `   • Доля: ${item.weightPercent}% ($${item.allocationUsd})\n`;
      if (item.coin.priceUsd) text += `   • Цена: $${item.coin.priceUsd} (${item.tokenAmount} токенов)\n`;
      text += `   • Фонды: ${fundsStr}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  // Send to Telegram
  const handleSendTelegramPortfolio = async () => {
    if (!rule.telegramBotToken || !rule.telegramChatId) {
      alert('Укажите Telegram Bot Token и Chat ID в разделе «Настройки триггеров»');
      return;
    }
    if (portfolioAllocations.length === 0) {
      alert('Выберите хотя бы одну монету для сборки портфеля');
      return;
    }

    setTelegramSending(true);
    try {
      let msg = `🏛 <b>ИНСТИТУЦИОНАЛЬНЫЙ ПОРТФЕЛЬ ИЗ ПЕРЕСЕЧЕНИЙ ФОНДОВ</b> 💼\n\n`;
      msg += `💰 <b>Сумма инвестиций:</b> $${investmentBudget.toLocaleString('en-US')}\n`;
      msg += `🎯 <b>Активов в портфеле:</b> ${portfolioAllocations.length} шт.\n`;
      msg += `⚖️ <b>Стратегия долей:</b> ${weightStrategy === 'consensus' ? 'Взвешивание по числу фондов' : 'Равные доли'}\n\n`;
      msg += `<b>РАСПРЕДЕЛЕНИЕ АКТИВОВ:</b>\n`;

      portfolioAllocations.forEach((item, idx) => {
        const fundsStr = item.coin.funds
          .map((fId) => fundsMap.get(fId)?.shortName || fId)
          .slice(0, 4)
          .join(', ');

        const priceStr = item.coin.priceUsd ? `$${item.coin.priceUsd < 0.01 ? item.coin.priceUsd.toFixed(6) : item.coin.priceUsd.toFixed(2)}` : 'N/A';
        msg += `${idx + 1}. <b>${item.coin.symbol}</b>: <code>${item.weightPercent}%</code> ($${item.allocationUsd})\n`;
        msg += `   💵 Цена: ${priceStr} | 🪙 ${item.tokenAmount} шт.\n`;
        msg += `   🏛 Фонды (${item.coin.funds.length}): <i>${fundsStr}</i>\n\n`;
      });

      msg += `⚡ <i>CryptoDrop Alert — Мониторинг просадок 5–20% для институциональных монет</i>`;

      const telegramUrl = `https://api.telegram.org/bot${rule.telegramBotToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: rule.telegramChatId,
          text: msg,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const tgJson = await tgRes.json();
      if (tgRes.ok && tgJson.ok) {
        setTelegramSuccess(true);
        setTimeout(() => setTelegramSuccess(false), 4000);
      } else {
        alert(`Ошибка отправки: ${tgJson.description || 'Ошибка Telegram'}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setTelegramSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <Building className="w-3.5 h-3.5" />
              <span>Институциональный консенсус Tier 1 / Tier 2 венчурных фондов</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Сборка портфеля из пересечений инвестиций фондов
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Поиск монет, куда одновременно инвестировали ведущие венчурные фонды и институционалы: <b>Circle Ventures</b>, <b>Coinbase</b>, <b>YZi Labs (Binance)</b>, <b>HashKey</b>, <b>Fenbushi Capital</b>, <b>The Spartan Group</b>, <b>ParaFi</b>, <b>DeFiance</b>, <b>SNZ Holding</b>, <b>Citadel Securities</b>, <b>Galaxy</b>, <b>Blackstone</b>, <b>Republic</b>, <b>DCG</b>, <b>Arrington</b> и <b>Multicoin Capital</b>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium">Фондов в базе</div>
              <div className="text-lg font-bold text-white font-mono-numbers">{CRYPTO_FUNDS.length}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-amber-400 font-medium">Пересечений</div>
              <div className="text-lg font-bold text-amber-300 font-mono-numbers">{filteredCoins.length}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-emerald-400 font-medium">В портфеле</div>
              <div className="text-lg font-bold text-emerald-400 font-mono-numbers">{selectedCoinSymbols.size}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-indigo-400 font-medium">Бюджет</div>
              <div className="text-lg font-bold text-indigo-300 font-mono-numbers">${investmentBudget}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Buttons & Strategy Quick Filters */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Пресеты:
            </span>
            <button
              onClick={() => applyFundPreset('circle-coinbase-yzi')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-amber-950/40 border-amber-500/40 text-amber-200 hover:bg-amber-900/50 transition-colors"
            >
              ⭐ Circle + Coinbase + YZi Labs
            </button>
            <button
              onClick={() => applyFundPreset('tier1')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 transition-colors"
            >
              🏛 Все Tier-1 (14)
            </button>
            <button
              onClick={() => applyFundPreset('asian-vcs')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-rose-950/40 border-rose-500/40 text-rose-200 hover:bg-rose-900/50 transition-colors"
              title="HashKey + Fenbushi + Spartan Group + SNZ Holding + YZi Labs"
            >
              🌏 Азия (HashKey + Fenbushi + Spartan + SNZ)
            </button>
            <button
              onClick={() => applyFundPreset('institutional')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-blue-950/40 border-blue-500/40 text-blue-200 hover:bg-blue-900/50 transition-colors"
              title="Citadel Securities + Galaxy + Blackstone + DCG + Coinbase"
            >
              🏦 Институционалы (Citadel + Galaxy + Blackstone + DCG)
            </button>
            <button
              onClick={() => applyFundPreset('defi-giants')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-emerald-950/40 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/50 transition-colors"
              title="ParaFi + DeFiance + Paradigm + a16z + Pantera"
            >
              ⚡ DeFi элита (ParaFi + DeFiance + Paradigm)
            </button>
            <button
              onClick={() => applyFundPreset('a16z-paradigm')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 transition-colors"
            >
              💎 a16z + Paradigm + Multicoin
            </button>
            <button
              onClick={() => applyFundPreset('all')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 transition-colors"
            >
              🌐 Все {CRYPTO_FUNDS.length} фондов
            </button>
          </div>

          <div className="relative shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по тикеру/названию..."
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Individual Fund Multi-Select Chips */}
        <div>
          <div className="text-[11px] font-medium text-slate-400 mb-2 flex flex-wrap items-center justify-between gap-2">
            <span>
              Фонды в анализе (<b className="text-amber-300 font-mono-numbers">{selectedFundIds.size}</b> из {CRYPTO_FUNDS.length} активно):
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={selectAllFunds}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Выбрать все ({CRYPTO_FUNDS.length})
              </button>
              <span className="text-slate-600">·</span>
              <button
                onClick={clearAllFunds}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Снять все
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CRYPTO_FUNDS.map((fund) => {
              const isSelected = selectedFundIds.has(fund.id);
              return (
                <button
                  key={fund.id}
                  onClick={() => toggleFund(fund.id)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800 border-slate-600 text-white font-medium shadow-sm'
                      : 'bg-slate-950/70 border-slate-800/80 text-slate-500 hover:text-slate-400 hover:bg-slate-900'
                  }`}
                  title={`${fund.name} (${fund.tier.toUpperCase()}) - ${fund.description}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-amber-400' : 'bg-slate-600'
                    }`}
                  />
                  <span>{fund.shortName}</span>
                  {fund.tier === 'tier1' && (
                    <span className="text-[9px] text-amber-400/80 font-mono-numbers">T1</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filters: Overlap Depth & Category */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Min Overlap */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
              <span>Минимум пересекающихся фондов:</span>
              <span className="text-amber-300 font-bold font-mono-numbers">≥ {minOverlap}</span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setMinOverlap(cnt)}
                  className={`py-1 rounded text-center font-medium ${
                    minOverlap === cnt
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cnt}+
                </button>
              ))}
            </div>
          </div>

          {/* Tier Filter */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Фильтр по уровню фонда:
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setTierFilter('all')}
                className={`py-1 rounded text-center font-medium ${
                  tierFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tier 1 + Tier 2
              </button>
              <button
                onClick={() => setTierFilter('tier1')}
                className={`py-1 rounded text-center font-medium ${
                  tierFilter === 'tier1'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Только Tier 1
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Сектор / Направление:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все секторы</option>
              <option value="L1/L2">Layer 1 / Layer 2</option>
              <option value="DeFi">DeFi & DEX</option>
              <option value="AI & Data">AI & Data Networks</option>
              <option value="Infrastructure">Инфраструктура & Модули</option>
              <option value="Interop">Межсетевые мосты (Interop)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Left = Intersecting Coins Table / Cards; Right = Portfolio Assembly Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Intersecting Coins List (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                Найдено монет с пересечением: {filteredCoins.length}
              </span>
              <span className="text-slate-500">·</span>
              <span>Выбрано для портфеля: <b>{selectedCoinSymbols.size}</b></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={selectAllFiltered}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Выбрать все
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={deselectAll}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                Снять выбор
              </button>
            </div>
          </div>

          {filteredCoins.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-sm font-semibold text-white">Пересечений с выбранными фильтрами не найдено</div>
              <div className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Попробуйте снизить минимальное число фондов до 1+ или выберите больше венчурных фондов.
              </div>
              <button
                onClick={() => applyFundPreset('all')}
                className="mt-4 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredCoins.map(({ coin, matchedFunds, matchedCount }) => {
                const isSelected = selectedCoinSymbols.has(coin.symbol);
                const isTracked = trackedCoinSymbols.has(coin.symbol.toUpperCase());

                return (
                  <div
                    key={coin.symbol}
                    className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'border-amber-500/40 bg-slate-900/90 shadow-sm'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="p-4">
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <button
                            onClick={() => toggleSelectCoin(coin.symbol)}
                            className="mt-0.5 text-slate-400 hover:text-white transition-colors"
                          >
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                            ) : (
                              <CircleDot className="w-5 h-5 text-slate-600" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-white tracking-tight">
                                {coin.symbol}
                              </span>
                              <span className="text-xs font-medium text-slate-300">
                                {coin.name}
                              </span>
                              <span className="text-slate-500 text-xs">·</span>
                              <span className="text-xs text-slate-400">{coin.category}</span>

                              {/* Overlap Consensus Count Badge */}
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono-numbers">
                                <Building className="w-3 h-3" />
                                {matchedCount} {matchedCount === 1 ? 'фонд' : matchedCount < 5 ? 'фонда' : 'фондов'}
                              </span>

                              {/* TokenInsight Rating Badge */}
                              {(() => {
                                const rank = coin.rank || 999;
                                const rating = rank <= 15 ? 'AAA' : rank <= 50 ? 'AA' : rank <= 150 ? 'A' : 'BBB';
                                const ratingColor =
                                  rating === 'AAA'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : rating === 'AA'
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : rating === 'A'
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700';
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${ratingColor}`}
                                    title="Рейтинг TokenInsight"
                                  >
                                    TI: {rating}
                                  </span>
                                );
                              })()}
                            </div>

                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {coin.description}
                            </p>
                          </div>
                        </div>

                        {/* Live Price & Change */}
                        <div className="text-right shrink-0 font-mono-numbers">
                          <div className="text-sm font-bold text-white">
                            {coin.priceUsd && coin.priceUsd > 0
                              ? `$${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(2)}`
                              : 'В пуле'}
                          </div>
                          {coin.change24h !== undefined && (
                            <div
                              className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                                coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {coin.change24h >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>
                                {coin.change24h >= 0 ? '+' : ''}
                                {coin.change24h.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Investing Funds Row */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">Инвесторы:</span>
                          {coin.funds.map((fId) => {
                            const fundObj = fundsMap.get(fId);
                            const isLead = coin.leadFunds?.includes(fId);
                            const isMatchedInFilter = selectedFundIds.has(fId);

                            return (
                              <span
                                key={fId}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  isMatchedInFilter
                                    ? isLead
                                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-semibold'
                                      : 'bg-slate-800 text-slate-200 border-slate-700'
                                    : 'bg-slate-950 text-slate-500 border-slate-800'
                                }`}
                                title={fundObj?.description || fundObj?.name}
                              >
                                {fundObj?.shortName || fId}
                                {isLead && ' ★'}
                              </span>
                            );
                          })}
                        </div>

                        {coin.rounds && coin.rounds.length > 0 && (
                          <div className="text-[11px] text-slate-400 font-mono-numbers">
                            {coin.rounds.join(' · ')}
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleSelectCoin(coin.symbol)}
                            className={`px-2.5 py-1 rounded font-medium transition-colors ${
                              isSelected
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isSelected ? '✓ В портфеле' : '+ Добавить в портфель'}
                          </button>

                          <button
                            onClick={() =>
                              onAddTrackedCoin({
                                id: coin.symbol,
                                symbol: coin.symbol,
                                name: coin.name,
                                priceUsd: coin.priceUsd || 0,
                              })
                            }
                            disabled={isTracked}
                            className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                              isTracked
                                ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                            }`}
                            title="Добавить в корзину для мгновенных алертов при падении 5–20%"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>{isTracked ? 'В алертах' : 'Мониторить падение 5-20%'}</span>
                          </button>
                        </div>

                        <a
                          href={`https://www.tradingview.com/chart/?symbol=BINANCE:${coin.symbol}USDT`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span>TradingView</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Portfolio Assembly & Calculator Drawer (4 cols) */}
        <div className="lg:col-span-4 sticky top-20 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Ваш портфель фондов</h3>
                  <div className="text-[11px] text-slate-400">
                    {portfolioAllocations.length} {portfolioAllocations.length === 1 ? 'монета' : portfolioAllocations.length < 5 ? 'монеты' : 'монет'}
                  </div>
                </div>
              </div>
            </div>

            {/* Budget Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Общий бюджет инвестиций ($):</span>
                <span className="text-amber-400 font-mono-numbers font-bold">
                  ${investmentBudget.toLocaleString()}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="100"
                  max="1000000"
                  step="500"
                  value={investmentBudget}
                  onChange={(e) => setInvestmentBudget(Math.max(10, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quick budget buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                {[1000, 3000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setInvestmentBudget(val)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      investmentBudget === val
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ${val / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* Weight Strategy Toggle */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Принцип распределения долей:
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setWeightStrategy('consensus')}
                  className={`py-1.5 px-2 rounded text-center font-medium transition-colors ${
                    weightStrategy === 'consensus'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Чем больше фондов инвестировали в монету, тем выше её доля в портфеле"
                >
                  По консенсусу фондов
                </button>
                <button
                  onClick={() => setWeightStrategy('equal')}
                  className={`py-1.5 px-2 rounded text-center font-medium transition-colors ${
                    weightStrategy === 'equal'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Равные доли
                </button>
              </div>
            </div>

            {/* Selected Coins Breakdown List */}
            {portfolioAllocations.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-slate-800/80 bg-slate-950/60 text-xs text-slate-400">
                Отметьте монеты из списка слева, чтобы сформировать портфель и рассчитать доли.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Распределение позиций:</span>
                  <span>Доля / Сумма</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60 font-mono-numbers text-xs">
                  {portfolioAllocations.map((item) => (
                    <div
                      key={item.coin.symbol}
                      className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.coin.symbol}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          ({item.coin.funds.length} фондов)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-300">{item.weightPercent}%</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">
                          (${item.allocationUsd})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: Add to drop monitoring + Telegram export */}
            {portfolioAllocations.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                {/* 1-Click: Monitor in basket */}
                <button
                  onClick={handleAddAllToMonitoring}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                  title="Добавить до 10 монет в корзину мониторинга просадок 5-20%"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Поставить весь портфель на мониторинг падений</span>
                </button>

                {/* Send to Telegram */}
                <button
                  onClick={handleSendTelegramPortfolio}
                  disabled={telegramSending}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    telegramSuccess
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-sm'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {telegramSending
                      ? 'Отправка в Telegram...'
                      : telegramSuccess
                      ? 'Портфель отправлен в Telegram!'
                      : 'Отправить портфель в Telegram'}
                  </span>
                </button>

                {/* Copy summary */}
                <button
                  onClick={handleCopySummary}
                  className="w-full py-1.5 px-3 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSummary ? 'Скопировано в буфер!' : 'Копировать состав портфеля'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
