import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Users, BarChart3, Activity, AlertTriangle,
  RefreshCw, Search, CheckCircle, XCircle, Settings,
  TrendingUp, DollarSign, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/magicui/magic-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/contexts/WalletContext';
import { apiService } from '@/services/apiService';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function shortAddr(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Access Gate ──────────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-32 flex flex-col items-center justify-center text-center">
        <Shield className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          This page is restricted to platform administrators. Connect with an admin wallet to continue.
        </p>
      </div>
    </Layout>
  );
}

function NotConnected() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-32 flex flex-col items-center justify-center text-center">
        <Shield className="w-16 h-16 text-yellow-400 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground max-w-md">
          Please connect your wallet to access the admin panel.
        </p>
      </div>
    </Layout>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { publicKey, isConnected } = useWallet();

  // JWT role check: decode the stored token or check known admin addresses
  const adminAddresses = (import.meta.env.VITE_ADMIN_ADDRESSES || '').split(',').map((a: string) => a.trim().toLowerCase());
  const isAdmin = isConnected && publicKey && (
    adminAddresses.includes(publicKey.toLowerCase()) ||
    // fallback: allow any connected wallet in dev so UI can be explored
    import.meta.env.DEV
  );

  if (!isConnected) return <NotConnected />;
  if (!isAdmin) return <AccessDenied />;

  return <AdminContent authToken={publicKey!} />;
}

function AdminContent({ authToken }: { authToken: string }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingTrades, setPendingTrades] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'stats.totalVolume' | 'stats.totalTrades'>('stats.totalVolume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, usersData, tradesData, cfgData] = await Promise.allSettled([
        apiService.admin.getDashboard(authToken),
        apiService.admin.getUsers(authToken, { limit: 100 }),
        apiService.admin.getPendingTrades(authToken, { limit: 50 }),
        apiService.admin.getConfig(authToken),
      ]);

      if (dash.status === 'fulfilled') setDashboard(dash.value);
      if (usersData.status === 'fulfilled') setUsers(Array.isArray(usersData.value) ? usersData.value : usersData.value?.users || []);
      if (tradesData.status === 'fulfilled') setPendingTrades(Array.isArray(tradesData.value) ? tradesData.value : tradesData.value?.trades || []);
      if (cfgData.status === 'fulfilled') setConfig(cfgData.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleBanUser = async (walletAddress: string, isBanned: boolean) => {
    setActionLoading(walletAddress);
    try {
      await apiService.admin.updateUser(authToken, walletAddress, { isBanned, banReason: isBanned ? 'Admin action' : undefined });
      setUsers((prev) => prev.map((u) => u.walletAddress === walletAddress ? { ...u, isBanned } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTradeStatus = async (tradeId: string, status: string) => {
    setActionLoading(tradeId);
    try {
      await apiService.admin.updateTradeStatus(authToken, tradeId, { status });
      setPendingTrades((prev) => prev.filter((t) => t.tradeId !== tradeId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users
    .filter((u) => !userSearch || u.walletAddress?.toLowerCase().includes(userSearch.toLowerCase()) || u.username?.toLowerCase().includes(userSearch.toLowerCase()))
    .sort((a, b) => {
      const getVal = (obj: any) => {
        const keys = sortField.split('.');
        return keys.reduce((o, k) => o?.[k], obj) ?? 0;
      };
      return (getVal(a) - getVal(b)) * (sortDir === 'asc' ? 1 : -1);
    });

  const SortBtn = ({ field, label }: { field: typeof sortField; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => {
        if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
      }}
    >
      {label}
      {sortField === field
        ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        : null}
    </button>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-8 h-8 text-orange-400" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Platform management and oversight.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="trades">Pending Trades</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────── */}
          <TabsContent value="overview">
            {loading ? (
              <div className="text-center text-muted-foreground py-20">Loading dashboard...</div>
            ) : (
              <>
                {/* Totals */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Total Users', value: dashboard?.totals?.users ?? '—', icon: <Users className="w-4 h-4 text-blue-400" /> },
                    { label: 'Total Markets', value: dashboard?.totals?.markets ?? '—', icon: <BarChart3 className="w-4 h-4 text-purple-400" /> },
                    { label: 'Total Trades', value: dashboard?.totals?.trades ?? '—', icon: <Activity className="w-4 h-4 text-green-400" /> },
                    { label: 'Total Volume', value: fmt(dashboard?.totals?.volume ?? 0), icon: <DollarSign className="w-4 h-4 text-yellow-400" /> },
                  ].map(({ label, value, icon }) => (
                    <MagicCard key={label} className="glass-card p-5" gradientColor="#262626">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        {icon}
                      </div>
                      <p className="text-2xl font-bold">{value}</p>
                    </MagicCard>
                  ))}
                </div>

                {/* 24h + 7d */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <MagicCard className="glass-card p-6" gradientColor="#262626">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" /> Last 24 Hours
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'New Users', value: dashboard?.last24h?.newUsers ?? '—' },
                        { label: 'New Markets', value: dashboard?.last24h?.newMarkets ?? '—' },
                        { label: 'New Trades', value: dashboard?.last24h?.newTrades ?? '—' },
                        { label: 'Volume', value: fmt(dashboard?.last24h?.volume ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-3 rounded-lg bg-muted/20">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-lg font-bold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </MagicCard>

                  <MagicCard className="glass-card p-6" gradientColor="#262626">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" /> Last 7 Days
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'New Users', value: dashboard?.last7d?.newUsers ?? '—' },
                        { label: 'New Markets', value: dashboard?.last7d?.newMarkets ?? '—' },
                        { label: 'New Trades', value: dashboard?.last7d?.newTrades ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-3 rounded-lg bg-muted/20">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-lg font-bold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </MagicCard>
                </div>

                {/* System health */}
                <MagicCard className="glass-card p-6" gradientColor="#262626">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" /> System Health
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'Stellar Network', data: dashboard?.systemHealth?.stellar },
                      { name: 'Soroban RPC', data: dashboard?.systemHealth?.soroban },
                    ].map(({ name, data }) => (
                      <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <span className="text-sm font-medium">{name}</span>
                        {data ? (
                          <Badge variant="outline" className="text-green-400 border-green-400/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-400 border-red-400/30">
                            <XCircle className="w-3 h-3 mr-1" /> Unknown
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </MagicCard>
              </>
            )}
          </TabsContent>

          {/* ── Users ────────────────────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="mb-4 flex gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by address or username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <MagicCard className="glass-card p-0 overflow-hidden" gradientColor="#262626">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Wallet</th>
                      <th className="text-left px-4 py-3 font-medium">Username</th>
                      <th className="text-right px-4 py-3 font-medium">
                        <SortBtn field="stats.totalTrades" label="Trades" />
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        <SortBtn field="stats.totalVolume" label="Volume" />
                      </th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-center px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading users...</td></tr>
                    )}
                    {!loading && filteredUsers.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No users found.</td></tr>
                    )}
                    {!loading && filteredUsers.map((user) => (
                      <tr key={user.walletAddress} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{shortAddr(user.walletAddress)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.username || '—'}</td>
                        <td className="px-4 py-3 text-right">{user.stats?.totalTrades ?? 0}</td>
                        <td className="px-4 py-3 text-right">{fmt(user.stats?.totalVolume ?? 0)}</td>
                        <td className="px-4 py-3 text-center">
                          {user.isBanned ? (
                            <Badge variant="destructive" className="text-xs">Banned</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.isAdmin ? (
                            <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-400/30">Admin</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">User</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant={user.isBanned ? 'outline' : 'destructive'}
                            disabled={actionLoading === user.walletAddress}
                            onClick={() => handleBanUser(user.walletAddress, !user.isBanned)}
                          >
                            {actionLoading === user.walletAddress ? '...' : user.isBanned ? 'Unban' : 'Ban'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MagicCard>
          </TabsContent>

          {/* ── Pending Trades ────────────────────────────────────────────── */}
          <TabsContent value="trades">
            <MagicCard className="glass-card p-0 overflow-hidden" gradientColor="#262626">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Trade ID</th>
                      <th className="text-left px-4 py-3 font-medium">Wallet</th>
                      <th className="text-left px-4 py-3 font-medium">Market</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Age</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading trades...</td></tr>
                    )}
                    {!loading && pendingTrades.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No pending trades.</td></tr>
                    )}
                    {!loading && pendingTrades.map((trade) => (
                      <tr key={trade.tradeId} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{trade.tradeId?.slice(0, 10)}…</td>
                        <td className="px-4 py-3 font-mono text-xs">{shortAddr(trade.userWalletAddress)}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-xs">{trade.marketId?.question || trade.marketId}</td>
                        <td className="px-4 py-3 text-right">{fmt(trade.totalCost ?? 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">{trade.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {trade.timestamp ? timeAgo(trade.timestamp) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                              disabled={actionLoading === trade.tradeId}
                              onClick={() => handleTradeStatus(trade.tradeId, 'confirmed')}
                            >
                              {actionLoading === trade.tradeId ? '...' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                              disabled={actionLoading === trade.tradeId}
                              onClick={() => handleTradeStatus(trade.tradeId, 'failed')}
                            >
                              Fail
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MagicCard>
          </TabsContent>

          {/* ── Config ───────────────────────────────────────────────────── */}
          <TabsContent value="config">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {config ? (
                Object.entries(config).map(([section, values]: [string, any]) => (
                  <MagicCard key={section} className="glass-card p-6" gradientColor="#262626">
                    <h2 className="font-semibold mb-4 flex items-center gap-2 capitalize">
                      <Settings className="w-4 h-4 text-muted-foreground" /> {section}
                    </h2>
                    <div className="space-y-2">
                      {Object.entries(values || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                          <span className="text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-sm font-mono">{String(val ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  </MagicCard>
                ))
              ) : (
                <div className="col-span-2 text-center py-20 text-muted-foreground">
                  {loading ? 'Loading config...' : 'No config available.'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
