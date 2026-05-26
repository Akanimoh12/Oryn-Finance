import { useEffect, useState, useCallback } from 'react';
import {
  Droplets, TrendingUp, RefreshCw, BarChart3, Activity,
  DollarSign, Percent, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/magicui/magic-card';
import { apiService } from '@/services/apiService';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

interface Pool {
  marketId: string;
  question: string;
  category: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  liquidity: number;
  tvl: number;
  utilizationPct: number;
  expiresAt: string;
}

interface DepthPoint {
  price: number;
  depth: number;
  cumulative: number;
}

interface DepthData {
  yes: DepthPoint[];
  no: DepthPoint[];
  midpoint: number;
  spread: number;
}

interface APYData {
  estimatedAPY: number;
  feeAPY: number;
  tradingAPY: number;
  daily24hVolume: number;
}

interface PoolDetail extends Pool {
  depth?: DepthData;
  apy?: APYData;
}

const CATEGORIES = ['All', 'crypto', 'sports', 'politics', 'economics', 'technology', 'entertainment', 'other'];

export default function LiquidityPools() {
  const [stats, setStats] = useState<any>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'tvl' | 'utilizationPct' | 'totalVolume'>('tvl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, poolsData] = await Promise.all([
        apiService.liquidity.getStats(),
        apiService.liquidity.getPools({ status: 'active', limit: 50 }),
      ]);
      setStats(statsData);
      setPools(poolsData?.pools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load liquidity data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPoolDetail = async (pool: Pool) => {
    setSelectedPool(pool as PoolDetail);
    setDetailLoading(true);
    try {
      const detail = await apiService.liquidity.getPool(pool.marketId);
      setSelectedPool(detail);
    } catch {
      // keep shallow data already set
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = pools
    .filter((p) => category === 'All' || p.category === category)
    .filter((p) => !search || p.question.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      return (a[sortField] - b[sortField]) * mul;
    });

  const utilizationColor = (pct: number) => {
    if (pct >= 80) return 'text-red-400';
    if (pct >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field
      ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />
      : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Droplets className="w-8 h-8 text-blue-400" />
              Liquidity Pools
            </h1>
            <p className="text-muted-foreground">Real-time pool utilization, APY estimates, and depth charts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MagicCard className="glass-card p-5" gradientColor="#1a2a3a">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Active Pools</p>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold">{stats?.activePools ?? '—'}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#1a2a3a">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Total Liquidity</p>
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold">{stats ? fmt(stats.totalLiquidity) : '—'}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#1a2a3a">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Avg Utilization</p>
              <Percent className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold">{stats ? pct(stats.avgUtilizationPct) : '—'}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#1a2a3a">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Top Pool TVL</p>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold">
              {stats?.topPools?.[0] ? fmt(stats.topPools[0].tvl) : '—'}
            </p>
          </MagicCard>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? 'default' : 'outline'}
                onClick={() => setCategory(c)}
                className="capitalize"
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {/* Pool table */}
        <MagicCard className="glass-card p-0 overflow-hidden mb-8" gradientColor="#1a2a3a">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Market</th>
                  <th className="text-right px-4 py-3 font-medium">YES / NO</th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('tvl')}
                  >
                    TVL <SortIcon field="tvl" />
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('totalVolume')}
                  >
                    Volume <SortIcon field="totalVolume" />
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('utilizationPct')}
                  >
                    Utilization <SortIcon field="utilizationPct" />
                  </th>
                  <th className="text-center px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading pools...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No pools found.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((pool) => (
                  <tr
                    key={pool.marketId}
                    className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate" title={pool.question}>{pool.question}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-green-400">{(pool.yesPrice * 100).toFixed(1)}¢</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-red-400">{(pool.noPrice * 100).toFixed(1)}¢</span>
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(pool.tvl)}</td>
                    <td className="px-4 py-3 text-right">{fmt(pool.totalVolume)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pool.utilizationPct >= 80 ? 'bg-red-400' : pool.utilizationPct >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${pool.utilizationPct}%` }}
                          />
                        </div>
                        <span className={utilizationColor(pool.utilizationPct)}>
                          {pct(pool.utilizationPct)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="capitalize text-xs">
                        {pool.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openPoolDetail(pool)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MagicCard>

        {/* Pool Detail Panel */}
        {selectedPool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between p-6 border-b border-border/40">
                <div>
                  <h2 className="text-xl font-bold mb-1">{selectedPool.question}</h2>
                  <Badge variant="outline" className="capitalize">{selectedPool.category}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPool(null)}>✕</Button>
              </div>

              {detailLoading ? (
                <div className="p-12 text-center text-muted-foreground">Loading pool details...</div>
              ) : (
                <div className="p-6 space-y-8">
                  {/* Key metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'TVL', value: fmt(selectedPool.tvl) },
                      { label: 'Volume', value: fmt(selectedPool.totalVolume) },
                      { label: 'Utilization', value: pct(selectedPool.utilizationPct) },
                      { label: 'Est. APY', value: selectedPool.apy ? pct(selectedPool.apy.estimatedAPY) : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-4 rounded-lg bg-muted/20 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className="text-lg font-bold">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* APY breakdown */}
                  {selectedPool.apy && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400" /> APY Breakdown
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                          <p className="text-xs text-muted-foreground">Total APY</p>
                          <p className="text-xl font-bold text-green-400">{pct(selectedPool.apy.estimatedAPY)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                          <p className="text-xs text-muted-foreground">Fee APY</p>
                          <p className="text-xl font-bold text-blue-400">{pct(selectedPool.apy.feeAPY)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                          <p className="text-xs text-muted-foreground">Protocol APY</p>
                          <p className="text-xl font-bold text-purple-400">{pct(selectedPool.apy.tradingAPY)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        24h trading volume: {fmt(selectedPool.apy.daily24hVolume)}
                      </p>
                    </div>
                  )}

                  {/* Depth chart */}
                  {selectedPool.depth && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-400" /> Liquidity Depth
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Midpoint: {(selectedPool.depth.midpoint * 100).toFixed(1)}¢ &nbsp;|&nbsp;
                        Spread: {(selectedPool.depth.spread * 100).toFixed(1)}¢
                      </p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={selectedPool.depth.yes.map((y, i) => ({
                            price: y.price,
                            yesCumulative: y.cumulative,
                            noCumulative: selectedPool.depth!.no[i]?.cumulative ?? 0,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="price"
                              tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              formatter={(v: any, name: string) => [fmt(Number(v)), name]}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Legend />
                            <ReferenceLine x={selectedPool.depth.midpoint} stroke="#888" strokeDasharray="4 4" label={{ value: 'mid', fill: '#888', fontSize: 10 }} />
                            <Area type="stepAfter" dataKey="yesCumulative" name="YES depth" stroke="hsl(var(--chart-yes))" fill="hsl(var(--chart-yes))" fillOpacity={0.25} strokeWidth={2} />
                            <Area type="stepAfter" dataKey="noCumulative" name="NO depth" stroke="hsl(var(--chart-no))" fill="hsl(var(--chart-no))" fillOpacity={0.25} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Utilization bar */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pool Utilization</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${selectedPool.utilizationPct >= 80 ? 'bg-red-400' : selectedPool.utilizationPct >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${selectedPool.utilizationPct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${utilizationColor(selectedPool.utilizationPct)}`}>
                        {pct(selectedPool.utilizationPct)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Liquidity: {fmt(selectedPool.liquidity)} &nbsp;|&nbsp; Volume: {fmt(selectedPool.totalVolume)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
