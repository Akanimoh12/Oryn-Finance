// API Configuration for Oryn Finance Backend
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:5001/api'),
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

// API Endpoints
export const ENDPOINTS = {
  // Health & Status
  HEALTH: '/health',
  HEALTH_CONTRACTS: '/health/contracts',
  
  // Network & Transactions
  NETWORK_INFO: '/transactions/network-info',
  CURRENT_LEDGER: '/transactions/current-ledger',
  TRANSACTION_STATUS: (txHash: string) => `/transactions/status/${txHash}`,
  GOVERNANCE_PROPOSALS: '/transactions/governance/proposals',
  
  // Transaction Building
  BUILD_CREATE_MARKET: '/transactions/build/create-market',
  BUILD_BUY_TOKENS: '/transactions/build/buy-tokens',
  BUILD_SELL_TOKENS: '/transactions/build/sell-tokens',
  BUILD_CLAIM_WINNINGS: '/transactions/build/claim-winnings',
  BUILD_SWAP: '/transactions/build/swap',
  BUILD_ADD_LIQUIDITY: '/transactions/build/add-liquidity',
  BUILD_STAKE: '/transactions/build/stake',
  BUILD_VOTE: '/transactions/build/vote',
  BUILD_PURCHASE_INSURANCE: '/transactions/build/purchase-insurance',
  BUILD_SUBMIT_PRIVATE_ORDER: '/transactions/build/submit-private-order',
  
  // Transaction Submission
  SUBMIT_TRANSACTION: '/transactions/submit',
  
  // Markets
  MARKETS: '/markets',
  MARKET_DETAIL: (id: string) => `/markets/${id}`,
  MARKET_TRADES: (id: string) => `/markets/${id}/trades`,
  
  // Trades
  TRADES: '/trades',
  TRADE_DETAIL: (tradeId: string) => `/trades/${tradeId}`,
  TRADE_HISTORY: '/trades/history',
  RECENT_TRADES: '/trades/recent',
  
  // Users
  USERS: '/users',
  USER_PROFILE: '/users/profile',
  USER_BY_ADDRESS: (address: string) => `/users/${address}`,
  USER_POSITIONS: '/users/positions',
  USER_STATS: '/users/stats',
  
  // Leaderboard
  LEADERBOARD: '/leaderboard',
  REPUTATION_LEADERBOARD: '/leaderboard/reputation',
  
  // Analytics
  ANALYTICS: '/analytics',
  ANALYTICS_STATS: '/analytics/stats',
  ANALYTICS_MARKET_TRENDS: '/analytics/market-trends',
  ANALYTICS_PRICE_TRENDS: '/analytics/price-trends',
  ANALYTICS_USER_INSIGHTS: '/analytics/user-insights',
  INDEXED_EVENTS: '/analytics/events',

  // Liquidity
  LIQUIDITY_STATS: '/liquidity/stats',
  LIQUIDITY_POOLS: '/liquidity/pools',
  LIQUIDITY_POOL: (marketId: string) => `/liquidity/pools/${marketId}`,
  LIQUIDITY_DEPTH: (marketId: string) => `/liquidity/pools/${marketId}/depth`,

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER: (walletAddress: string) => `/admin/users/${walletAddress}`,
  ADMIN_MARKETS_RESOLVE: (marketId: string) => `/admin/markets/${marketId}/resolve`,
  ADMIN_TRADES_PENDING: '/admin/trades/pending',
  ADMIN_TRADE: (tradeId: string) => `/admin/trades/${tradeId}`,
  ADMIN_CONFIG: '/admin/config',
  ADMIN_LOGS: '/admin/logs',
};

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  responseTime: string;
  services: {
    database: {
      status: string;
      host: string;
    };
    stellar: {
      status: string;
      network: string;
      latestLedger: number;
    };
    soroban: {
      isConnected: boolean;
      network: string;
      rpcUrl: string;
      contracts: {
        total: number;
        deployed: number;
      };
    };
  };
}

export interface NetworkInfo {
  network: string;
  passphrase: string;
  rpcUrl: string;
  latestLedger: number;
  horizonUrl: string;
}

export interface TransactionBuildResponse {
  xdr: string;
  fees: number;
  simulation: any;
}