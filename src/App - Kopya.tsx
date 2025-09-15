import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Checkbox } from './components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

// Sabit Ruki server listesi ve population metin + numeric değeri
const RUKI_SERVERS = [
  ["Twisting Nether", 260000],
  ["Tarren Mill", 347000],
  ["Kazzak", 318000],
  ["Outland", 67000],
  ["Stormscale", 414000],
  ["Burning Blade", 124000],
  ["Draenor", 356000],
  ["Antonidas", 184000],
  ["Tichondrius", 222000],
  ["Sanguino", 170000],
  ["Thrall", 139000],
  ["Hyjal", 231000],
  ["Argent Dawn", 196000],
  ["Grim Batol", 67000],
  ["Blackrock", 166000],
  ["Ragnaros", 167000],
  ["Blackhand", 275000],
  ["Al'Akir", 116000],
  ["Cho'gall", 116000],
  ["Ysondre", 84000],
  ["Eredar", 86000],
];

const formatPopulationText = (num: number | null) => {
  if (num === null) return "N/A";
  if (num >= 1000) return `${Math.floor(num / 1000)}k+`;
  return `${num}`;
};

const SubtleGrid = () => (
  <div
    className="fixed inset-0 opacity-[0.02] pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
      `,
      backgroundSize: '24px 24px'
    }}
  />
);

interface TokenRow {
  server: string;
  populationText: string;
  populationValue: number;
  gold: number;
  qty: number;
}

interface TokenData {
  id: string;
  name: string;
  data: TokenRow[];
}

type CheckboxState = Record<string, { bought: boolean; onSale: boolean }>;

export default function App() {
  const [tokenInput, setTokenInput] = useState('');
  const [threshold, setThreshold] = useState('20');
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkboxStates, setCheckboxStates] = useState<CheckboxState>(() => {
    try {
      const raw = localStorage.getItem("checkbox_states_v1");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [hideLowPop, setHideLowPop] = useState(false);
  const [showAllServers, setShowAllServers] = useState(false);

  useEffect(() => {
    localStorage.setItem("checkbox_states_v1", JSON.stringify(checkboxStates));
  }, [checkboxStates]);

  const goldIcon = <img src="/src/gold.png" alt="gold" className="inline-block w-4 h-4 ml-1" />;

  const findRowGold = (rows: any[], serverName: string) => {
    for (const r of rows) {
      if (!r) continue;
      const s = (r.Column1 || "").toString().trim();
      if (!s) continue;
      if (s.toLowerCase().includes(serverName.toLowerCase()) || serverName.toLowerCase().includes(s.toLowerCase())) {
        const rawGold = (r.Column3 || "").toString().replace(",", ".");
        const gold = parseFloat(rawGold) || 0;
        const qtyMatch = String(r.Column4 || "0").match(/\d+/);
        const qty = qtyMatch ? parseInt(qtyMatch[0]) : 0;
        return { gold, qty };
      }
    }
    return { gold: 0, qty: 0 };
  };

  const handleSearch = async () => {
    if (!tokenInput.trim()) return;
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragment: tokenInput })
      });

      const data = await response.json();
      const rows = data.rows || [];

      const rukiRows: TokenRow[] = RUKI_SERVERS.map(([name, pop]) => {
        const found = findRowGold(rows, name);
        return {
          server: name,
          populationText: formatPopulationText(pop),
          populationValue: pop,
          gold: found.gold,
          qty: found.qty
        };
      });

      let others: TokenRow[] = [];
      if (showAllServers) {
        const rukiNames = new Set(RUKI_SERVERS.map(r => r[0].toLowerCase()));
        const added = new Set<string>();
        for (const r of rows) {
          const serverRaw = (r.Column1 || "").toString().trim();
          if (!serverRaw) continue;
          if (rukiNames.has(serverRaw.toLowerCase())) continue;
          const serverKey = serverRaw.toLowerCase();
          if (added.has(serverKey)) continue;
          added.add(serverKey);
          const rawGold = (r.Column3 || "").toString().replace(",", ".");
          const gold = parseFloat(rawGold) || 0;
          const qtyMatch = String(r.Column4 || "0").match(/\d+/);
          const qty = qtyMatch ? parseInt(qtyMatch[0]) : 0;
          others.push({
            server: serverRaw,
            populationText: "N/A",
            populationValue: 0,
            gold,
            qty
          });
        }
      }

      const combined = [...rukiRows, ...others];

      const newToken: TokenData = {
        id: data.item_name || tokenInput,
        name: data.item_name || tokenInput,
        data: combined
      };

      setTokens(prev => [...prev, newToken]);
      setActiveTab(newToken.id);
      setTokenInput('');
    } catch (err) {
      console.error("Fetch error:", err);
    }

    setLoading(false);
  };

  const saveCheckboxLocal = (key: string, state: { bought: boolean; onSale: boolean }) => {
    setCheckboxStates(prev => {
      const next = { ...prev, [key]: state };
      try { localStorage.setItem("checkbox_states_v1", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const updateCheckbox = (tokenId: string, server: string, type: 'bought' | 'onSale', value: boolean) => {
    const key = `${tokenId}_${server}`;
    const prev = checkboxStates[key] || { bought: false, onSale: false };
    const nextState = { ...prev, [type]: value };
    saveCheckboxLocal(key, nextState);
  };

  const getServerCheckboxState = (tokenId: string, server: string) => {
    const key = `${tokenId}_${server}`;
    return checkboxStates[key] || { bought: false, onSale: false };
  };

  const computeVisibleAndStats = (token: TokenData) => {
    let data = token.data.slice();
    if (hideLowPop) data = data.filter(d => (d.populationValue || 0) >= 150000);

    const visibleWithGold = data.filter(d => d.gold > 0);
    const golds = visibleWithGold.map(d => d.gold);
    const min = golds.length ? Math.min(...golds) : 0;
    const max = golds.length ? Math.max(...golds) : 0;
    const avg = golds.length ? golds.reduce((a, b) => a + b, 0) / golds.length : 0;
    const delta = min > 0 ? ((max - min) / min) * 100 : 0;

    return { visibleRows: data, stats: { min, max, avg, delta } };
  };

  const handleRemoveToken = (tokenId: string) => {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    if (activeTab === tokenId) setActiveTab(tokens.length > 1 ? tokens[0].id : '');
  };

  const serverOrderIndex = (name: string) => {
    const idx = RUKI_SERVERS.findIndex(r => r[0].toLowerCase() === name.toLowerCase());
    return idx >= 0 ? idx : 9999;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortedData = (data: any[]) => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      let aVal: any = a[sortConfig.key];
      let bVal: any = b[sortConfig.key];
      if (sortConfig.key === 'server') {
        aVal = serverOrderIndex(a.server);
        bVal = serverOrderIndex(b.server);
      }
      if (sortConfig.key === 'population') {
        aVal = a.populationValue;
        bVal = b.populationValue;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY': return <TrendingDown className="w-4 h-4" />;
      case 'SELL': return <TrendingUp className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-emerald-400';
      case 'SELL': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const getProfitColor = (profit: number, signal: string) => {
    if (signal === 'BUY') return 'text-emerald-400';
    if (signal === 'SELL') return 'text-red-400';
    return 'text-amber-400';
  };

  const getDeltaColor = (delta: number) => {
    if (delta < 15) return "text-zinc-400";
    if (delta < 30) return "text-emerald-400";
    if (delta < 60) return "text-blue-400";
    if (delta < 100) return "text-purple-400";
    return "text-orange-400";
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <SubtleGrid />
      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl text-white mb-3 tracking-tight">Undermine Token Checker</h1>
          <p className="text-zinc-400 text-lg">Monitor WoW token prices across servers</p>
        </motion.div>

        {/* Search & Threshold */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-4 mb-2 bg-zinc-900/50 backdrop-blur-xl p-6 rounded-xl border border-zinc-800/50 items-center"
        >
          <div className="flex-1">
            <Input
              placeholder="Enter token fragment (#eu-draenor/238028-701)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 h-12 text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex items-center px-3">
            <div className="text-[11px] text-zinc-500 mr-3">% PROF:</div>
            <div className="w-14">
              <Input
                placeholder="20"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 text-center h-12"
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !tokenInput.trim()}
            className="px-8 h-12 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Search className="w-4 h-4" />
              </motion.div>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </motion.div>

        {/* Filters */}
        <div className="flex justify-end gap-6 mt-4 mb-6 pr-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!hideLowPop} onCheckedChange={(c) => setHideLowPop(!c)} className="data-[state=checked]:bg-blue-500" />
            <span className="text-xs text-zinc-300">Show low-populated servers.</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showAllServers} onCheckedChange={(c) => setShowAllServers(!!c)} className="data-[state=checked]:bg-blue-500" />
            <span className="text-xs text-zinc-300">Toggle between all and Ruki's servers.</span>
          </label>
        </div>

        {/* Tabs */}
        {tokens.length > 0 && !loading && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50">
              {tokens.map((token) => (
                <TabsTrigger key={token.id} value={token.id} className="relative group text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-zinc-800/50">
                  {token.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700"
                    onClick={(e) => { e.stopPropagation(); handleRemoveToken(token.id); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TabsTrigger>
              ))}
            </TabsList>

            {tokens.map((token) => {
              const { visibleRows, stats } = computeVisibleAndStats(token);
              const thresholdValue = parseFloat(threshold) || 20;
              const processed = visibleRows.map(row => {
                const profit = stats.avg > 0 ? ((row.gold - stats.avg) / stats.avg) * 100 : 0;
                let signal: 'BUY' | 'SELL' | 'IGNORE';
                if (profit <= -thresholdValue) signal = 'BUY';
                else if (profit >= thresholdValue) signal = 'SELL';
                else signal = 'IGNORE';
                const minSell = row.gold > 0 ? 0.95 * (row.gold * 1.3) : 0;
                return { ...row, profit, signal, minSell };
              });
              const sorted = getSortedData(processed);

              return (
                <TabsContent key={token.id} value={token.id} className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl text-white mb-4 tracking-tight">{token.name}</h2>
                    <div className="flex justify-center gap-[40px] text-sm items-end">
                      <div className="text-center">
                        <div className="text-zinc-500 mb-1">Min</div>
                        <div className="text-white text-lg font-medium">{stats.min.toFixed(3)} {goldIcon}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-500 mb-1">Max</div>
                        <div className="text-white text-lg font-medium">{stats.max.toFixed(3)} {goldIcon}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-500 mb-1">Avg</div>
                        <div className="text-white text-lg font-medium">{stats.avg.toFixed(3)} {goldIcon}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-500 mb-1">Δ</div>
                        <div className={`text-lg font-medium ${getDeltaColor(stats.delta)}`}>{stats.delta.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-6xl mx-auto">
                    <div className="bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/30 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-zinc-800/20 border-b border-zinc-800/30">
                            <tr>
                              <th className="p-4 text-left cursor-pointer hover:bg-zinc-800/20 text-zinc-400 text-sm font-medium" onClick={() => handleSort('population')}>Pop.</th>
                              <th className="p-4 text-left cursor-pointer hover:bg-zinc-800/20 text-zinc-400 text-sm font-medium" onClick={() => handleSort('server')}>Server</th>
                              <th className="p-4 text-left cursor-pointer hover:bg-zinc-800/20 text-zinc-400 text-sm font-medium" onClick={() => handleSort('gold')}>Gold</th>
                              <th className="p-4 text-left cursor-pointer hover:bg-zinc-800/20 text-zinc-400 text-sm font-medium" onClick={() => handleSort('minSell')}>Min Sell</th>
                              <th className="p-4 text-left cursor-pointer hover:bg-zinc-800/20 text-zinc-400 text-sm font-medium" onClick={() => handleSort('profit')}>% PROF</th>
                              <th className="p-4 text-left text-zinc-400 text-sm font-medium">Signal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((item, idx) => {
                              const chk = getServerCheckboxState(token.id, item.server);
                              return (
                                <motion.tr key={`${item.server}-${idx}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.01 }} className="border-t border-zinc-800/20 hover:bg-zinc-800/10">
                                  <td className="p-4 text-center text-sm text-zinc-500">{item.populationText}</td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-4">
                                      <span className="text-white">{item.server}</span>
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center space-x-1">
                                          <Checkbox checked={chk.bought} onCheckedChange={(c) => updateCheckbox(token.id, item.server, 'bought', !!c)} className="border-zinc-600 data-[state=checked]:bg-emerald-500 w-3 h-3" />
                                          <span className="text-xs text-zinc-400">B</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <Checkbox checked={chk.onSale} onCheckedChange={(c) => updateCheckbox(token.id, item.server, 'onSale', !!c)} className="border-zinc-600 data-[state=checked]:bg-amber-400 w-3 h-3" />
                                          <span className="text-xs text-zinc-400">A</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center font-mono text-white">{item.gold.toFixed(3)} {goldIcon}</td>
                                  <td className="p-4 text-center font-mono text-zinc-300">{item.minSell.toFixed(3)} {goldIcon}</td>
                                  <td className={`p-4 text-center font-mono font-medium ${getProfitColor(item.profit, item.signal)}`}>{item.profit >= 0 ? '+' : ''}{item.profit.toFixed(2)}%</td>
                                  <td className="p-4 text-center">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-800/30 border border-zinc-700/30 ${getSignalColor(item.signal)}`}>
                                      {getSignalIcon(item.signal)}
                                      <span className="text-sm font-medium">{item.signal}</span>
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}
