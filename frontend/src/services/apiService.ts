import { apiClient } from '@/lib/api-client';
import { ENDPOINTS, ApiResponse, HealthResponse, NetworkInfo, TransactionBuildResponse } from '@/lib/api-config';

// Health & Status Services
export const healthService = {
  // Check backend health
  async getHealth(): Promise<HealthResponse> {
    const response = await apiClient.get<HealthResponse>(ENDPOINTS.HEALTH);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get health status');
    }
    return response.data!;
  },

  // Check contract integration status
  async getContractsHealth(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.HEALTH_CONTRACTS);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get contracts status');
    }
    return response.data;
  },

  // Test backend connectivity
  async testConnection() {
    return apiClient.testConnection();
  },
};

// Network & Transaction Services
export const networkService = {
  // Get network information
  async getNetworkInfo(): Promise<NetworkInfo> {
    const response = await apiClient.get<NetworkInfo>(ENDPOINTS.NETWORK_INFO);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get network info');
    }
    return response.data!;
  },

  // Get current ledger
  async getCurrentLedger(): Promise<number> {
    const response = await apiClient.get<{ currentLedger: number }>(ENDPOINTS.CURRENT_LEDGER);
    if (!response.success) {
      throw new Error(response.message || 'Failed to get current ledger');
    }
    return response.data!.currentLedger;
  },

  // Get transaction status
  async getTransactionStatus(txHash: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.TRANSACTION_STATUS(txHash));
    if (!response.success) {
      throw new Error(response.message || 'Failed to get transaction status');
    }
    return response.data;
  },
};

// Transaction Building Services
export const transactionService = {
  // Build create market transaction
  async buildCreateMarket(data: {
    question: string;
    category: string;
    expiryTimestamp: number;
    initialLiquidity: number;
    marketContract?: string;
    poolAddress?: string;
    yesToken?: string;
    noToken?: string;
  }, walletAddress: string): Promise<TransactionBuildResponse> {
    // Use wallet address directly as auth token (testing mode)
    apiClient.setAuthToken(walletAddress);
    
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_CREATE_MARKET, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build create market transaction');
    }
    return response.data!;
  },

  // Build buy tokens transaction
  async buildBuyTokens(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_BUY_TOKENS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build buy tokens transaction');
    }
    return response.data!;
  },

  // Build sell tokens transaction
  async buildSellTokens(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_SELL_TOKENS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build sell tokens transaction');
    }
    return response.data!;
  },

  // Build swap transaction
  async buildSwap(data: {
    fromToken: string;
    toToken: string;
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_SWAP, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build swap transaction');
    }
    return response.data!;
  },

  async buildClaimWinnings(data: {
    marketContract: string;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_CLAIM_WINNINGS, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build claim winnings transaction');
    }
    return response.data!;
  },

  async buildAddLiquidity(data: {
    tokenA: string;
    tokenB: string;
    amountA: number;
    amountB: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_ADD_LIQUIDITY, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build add liquidity transaction');
    }
    return response.data!;
  },

  async buildStake(data: {
    amount: number;
    lockPeriod: number;
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_STAKE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build stake transaction');
    }
    return response.data!;
  },

  async buildVote(data: {
    proposalId: number | string;
    choice: 'YES' | 'NO' | 'ABSTAIN';
  }, authToken: string): Promise<TransactionBuildResponse> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post<TransactionBuildResponse>(ENDPOINTS.BUILD_VOTE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to build vote transaction');
    }
    return response.data!;
  },

  // Submit signed transaction
  async submitTransaction(data: {
    xdr: string;
    networkPassphrase?: string;
  }): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.SUBMIT_TRANSACTION, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to submit transaction');
    }
    return response.data;
  },

  // Submit signed transaction to Stellar network
  async submitSignedTransaction(data: {
    signedXdr: string;
  }): Promise<any> {
    const response = await apiClient.post('/transactions/submit', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to submit signed transaction');
    }
    return response.data;
  },
};

// Market Services
export const marketService = {
  // Get all markets
  async getMarkets(filters?: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `${ENDPOINTS.MARKETS}?${queryParams}`
      : ENDPOINTS.MARKETS;
      
    const response = await apiClient.get<any>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch markets');
    }
    
    // Return the nested data structure from the API
    return response.data;
  },

  // Get market by ID
  async getMarket(id: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.MARKET_DETAIL(id));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market');
    }
    return response.data;
  },

  // Get market trades
  async getMarketTrades(id: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(ENDPOINTS.MARKET_TRADES(id));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market trades');
    }
    return response.data!;
  },
};

// User Services
export const userService = {
  // Get user profile
  async getProfile(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.USER_PROFILE);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user profile');
    }
    return response.data;
  },

  // Update user profile
  async updateProfile(data: any, authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.USER_PROFILE, data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update profile');
    }
    return response.data;
  },

  // Get user by wallet address
  async getUserByAddress(address: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.USER_BY_ADDRESS(address));
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user data');
    }
    return response.data;
  },

  async getUserPositions(authToken: string, filters?: { status?: string; page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.USER_POSITIONS}?${queryParams}`
      : ENDPOINTS.USER_POSITIONS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user positions');
    }
    return response.data;
  },

  async getUserStats(authToken: string, filters?: { timeframe?: string; marketId?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.USER_STATS}?${queryParams}`
      : ENDPOINTS.USER_STATS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user stats');
    }
    return response.data;
  },
};

// Trade Services
export const tradeService = {
  // Calculate swap output with slippage protection
  async calculateSwapOutput(data: {
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    slippageTolerance?: number;
  }): Promise<any> {
    const response = await apiClient.post('/trades/calculate-swap', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to calculate swap output');
    }
    return response.data;
  },

  // Get trade history
  async getTradeHistory(authToken: string, filters?: {
    marketId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `/trades/history?${queryParams}`
      : '/trades/history';
      
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch trade history');
    }
    return response.data;
  },

  // Execute trade
  async executeTrade(data: {
    marketId: string;
    tokenType: 'yes' | 'no';
    action: 'buy' | 'sell';
    amount: number;
    maxSlippage?: number;
  }, authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.post('/trades', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to execute trade');
    }
    return response.data;
  },

  // Get single trade by ID
  async getTradeById(tradeId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.TRADE_DETAIL(tradeId));
    if (!response.success) {
      throw new Error(response.message || 'Trade not found');
    }
    return response.data;
  },
};

// Leaderboard Services
export const leaderboardService = {
  async getReputationLeaderboard(limit = 50): Promise<any[]> {
    const endpoint = `${ENDPOINTS.REPUTATION_LEADERBOARD}?limit=${limit}`;
    const response = await apiClient.get<any[]>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch reputation leaderboard');
    }
    return response.data!;
  },

  async getLeaderboard(params?: { limit?: number; timeframe?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = queryParams.toString() 
      ? `/leaderboard?${queryParams}`
      : '/leaderboard';
      
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch leaderboard');
    }
    return response.data;
  },
};

export const analyticsService = {
  async getPlatformStats(timeframe = '30d'): Promise<any> {
    const response = await apiClient.get(`${ENDPOINTS.ANALYTICS_STATS}?timeframe=${timeframe}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch platform stats');
    }
    return response.data;
  },

  async getMarketTrends(params?: { timeframe?: string; interval?: string; category?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.ANALYTICS_MARKET_TRENDS}?${queryParams}`
      : ENDPOINTS.ANALYTICS_MARKET_TRENDS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch market trends');
    }
    return response.data;
  },

  async getPriceTrends(params?: { timeframe?: string; interval?: string; marketId?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.ANALYTICS_PRICE_TRENDS}?${queryParams}`
      : ENDPOINTS.ANALYTICS_PRICE_TRENDS;

    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch price trends');
    }
    return response.data;
  },

  async getUserInsights(walletAddress: string, timeframe = '30d'): Promise<any> {
    const endpoint = `${ENDPOINTS.ANALYTICS_USER_INSIGHTS}?walletAddress=${encodeURIComponent(walletAddress)}&timeframe=${encodeURIComponent(timeframe)}`;
    const response = await apiClient.get(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch user insights');
    }
    return response.data;
  },

  async getIndexedEvents(filters?: { contractName?: string; topic?: string; marketId?: string; limit?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const endpoint = queryParams.toString()
      ? `${ENDPOINTS.INDEXED_EVENTS}?${queryParams}`
      : ENDPOINTS.INDEXED_EVENTS;

    const response = await apiClient.get<any[]>(endpoint);
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch indexed events');
    }
    return response.data!;
  }
};

// Liquidity Services
export const liquidityService = {
  async getStats(): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_STATS);
    if (!response.success) throw new Error(response.message || 'Failed to fetch liquidity stats');
    return response.data;
  },

  async getPools(params?: { category?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.LIQUIDITY_POOLS}?${queryParams}` : ENDPOINTS.LIQUIDITY_POOLS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch liquidity pools');
    return response.data;
  },

  async getPool(marketId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_POOL(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch pool');
    return response.data;
  },

  async getDepthChart(marketId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.LIQUIDITY_DEPTH(marketId));
    if (!response.success) throw new Error(response.message || 'Failed to fetch depth chart');
    return response.data;
  },
};

// Admin Services
export const adminService = {
  async getDashboard(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.ADMIN_DASHBOARD);
    if (!response.success) throw new Error(response.message || 'Failed to fetch admin dashboard');
    return response.data;
  },

  async getUsers(authToken: string, params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_USERS}?${queryParams}` : ENDPOINTS.ADMIN_USERS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch users');
    return response.data;
  },

  async updateUser(authToken: string, walletAddress: string, data: any): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_USER(walletAddress), data);
    if (!response.success) throw new Error(response.message || 'Failed to update user');
    return response.data;
  },

  async resolveMarket(authToken: string, marketId: string, data: { outcome: string; resolution: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_MARKETS_RESOLVE(marketId), data);
    if (!response.success) throw new Error(response.message || 'Failed to resolve market');
    return response.data;
  },

  async getPendingTrades(authToken: string, params?: { page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_TRADES_PENDING}?${queryParams}` : ENDPOINTS.ADMIN_TRADES_PENDING;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch pending trades');
    return response.data;
  },

  async updateTradeStatus(authToken: string, tradeId: string, data: { status: string; stellarTransactionHash?: string }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.put(ENDPOINTS.ADMIN_TRADE(tradeId), data);
    if (!response.success) throw new Error(response.message || 'Failed to update trade');
    return response.data;
  },

  async getConfig(authToken: string): Promise<any> {
    apiClient.setAuthToken(authToken);
    const response = await apiClient.get(ENDPOINTS.ADMIN_CONFIG);
    if (!response.success) throw new Error(response.message || 'Failed to fetch config');
    return response.data;
  },

  async getLogs(authToken: string, params?: { level?: string; page?: number; limit?: number }): Promise<any> {
    apiClient.setAuthToken(authToken);
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const endpoint = queryParams.toString() ? `${ENDPOINTS.ADMIN_LOGS}?${queryParams}` : ENDPOINTS.ADMIN_LOGS;
    const response = await apiClient.get(endpoint);
    if (!response.success) throw new Error(response.message || 'Failed to fetch logs');
    return response.data;
  },
};

// Combined API service object
export const apiService = {
  health: healthService,
  network: networkService,
  transactions: transactionService,
  markets: marketService,
  users: userService,
  trades: tradeService,
  leaderboard: leaderboardService,
  analytics: analyticsService,
  liquidity: liquidityService,
  admin: adminService,
};
