const { Market, Trade } = require('../models');
const logger = require('../config/logger');

class LiquidityController {
  // GET /api/liquidity/pools
  static async getPools(req, res) {
    try {
      const { category, status = 'active', page = 1, limit = 20 } = req.query;
      const filter = { status };
      if (category) filter.category = category;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [markets, total] = await Promise.all([
        Market.find(filter)
          .sort({ totalVolume: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Market.countDocuments(filter),
      ]);

      const pools = markets.map((m) => LiquidityController._buildPoolMetrics(m));

      res.json({
        success: true,
        data: { pools, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } },
      });
    } catch (error) {
      logger.error('getPools failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch liquidity pools' });
    }
  }

  // GET /api/liquidity/pools/:marketId
  static async getPool(req, res) {
    try {
      const { marketId } = req.params;
      const market = await Market.findOne({ marketId }).lean();
      if (!market) return res.status(404).json({ success: false, message: 'Pool not found' });

      // Fetch recent trades for depth data
      const recentTrades = await Trade.find({ marketId, status: 'confirmed' })
        .sort({ timestamp: -1 })
        .limit(200)
        .lean();

      const pool = LiquidityController._buildPoolMetrics(market);
      const depth = LiquidityController._buildDepthChart(market, recentTrades);
      const apy = LiquidityController._estimateAPY(market, recentTrades);

      res.json({ success: true, data: { ...pool, depth, apy } });
    } catch (error) {
      logger.error('getPool failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch pool' });
    }
  }

  // GET /api/liquidity/pools/:marketId/depth
  static async getDepthChart(req, res) {
    try {
      const { marketId } = req.params;
      const market = await Market.findOne({ marketId }).lean();
      if (!market) return res.status(404).json({ success: false, message: 'Market not found' });

      const recentTrades = await Trade.find({ marketId, status: 'confirmed' })
        .sort({ timestamp: -1 })
        .limit(500)
        .lean();

      const depth = LiquidityController._buildDepthChart(market, recentTrades);
      res.json({ success: true, data: depth });
    } catch (error) {
      logger.error('getDepthChart failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch depth chart' });
    }
  }

  // GET /api/liquidity/stats
  static async getStats(req, res) {
    try {
      const [activePools, totalVolumeAgg, topPools] = await Promise.all([
        Market.countDocuments({ status: 'active' }),
        Trade.aggregate([
          { $match: { status: 'confirmed' } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]),
        Market.find({ status: 'active' }).sort({ totalVolume: -1 }).limit(5).lean(),
      ]);

      const totalLiquidity = totalVolumeAgg[0]?.total || 0;
      const avgUtilization = topPools.reduce((acc, m) => acc + LiquidityController._utilization(m), 0) / (topPools.length || 1);

      res.json({
        success: true,
        data: {
          activePools,
          totalLiquidity,
          avgUtilizationPct: Math.round(avgUtilization * 100) / 100,
          topPools: topPools.map((m) => LiquidityController._buildPoolMetrics(m)),
        },
      });
    } catch (error) {
      logger.error('getStats failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch liquidity stats' });
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  static _utilization(market) {
    const liquidity = market.initialLiquidity || 1000;
    const volume = market.totalVolume || 0;
    return Math.min((volume / liquidity) * 100, 100);
  }

  static _buildPoolMetrics(market) {
    const liquidity = market.initialLiquidity || 1000;
    const yesPrice = market.yesPrice ?? 0.5;
    const noPrice = market.noPrice ?? 0.5;
    const utilization = LiquidityController._utilization(market);

    // Total value locked approximation
    const tvl = liquidity * (1 + (market.totalVolume || 0) / Math.max(liquidity, 1) * 0.1);

    return {
      marketId: market.marketId,
      question: market.question,
      category: market.category,
      status: market.status,
      yesPrice,
      noPrice,
      totalVolume: market.totalVolume || 0,
      liquidity,
      tvl: Math.round(tvl * 100) / 100,
      utilizationPct: Math.round(utilization * 100) / 100,
      expiresAt: market.expiresAt,
      createdAt: market.createdAt,
    };
  }

  static _estimateAPY(market, trades) {
    if (!trades.length) return { estimatedAPY: 0, feeAPY: 0, tradingAPY: 0 };

    const liquidity = market.initialLiquidity || 1000;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Estimate daily fees from recent trades (0.3% fee assumption)
    const last24hVolume = trades
      .filter((t) => now - new Date(t.timestamp).getTime() < dayMs)
      .reduce((sum, t) => sum + (t.totalCost || 0), 0);

    const dailyFees = last24hVolume * 0.003;
    const feeAPY = liquidity > 0 ? (dailyFees / liquidity) * 365 * 100 : 0;

    // Base protocol APY (mock incentive layer)
    const baseAPY = 5;
    const estimatedAPY = baseAPY + feeAPY;

    return {
      estimatedAPY: Math.round(estimatedAPY * 100) / 100,
      feeAPY: Math.round(feeAPY * 100) / 100,
      tradingAPY: baseAPY,
      daily24hVolume: Math.round(last24hVolume * 100) / 100,
    };
  }

  static _buildDepthChart(market, trades) {
    const yesPrice = market.yesPrice ?? 0.5;
    const noPrice = market.noPrice ?? 0.5;

    // Build synthetic order book from trade history
    const priceSteps = 10;
    const yesBids = [];
    const noBids = [];

    for (let i = 1; i <= priceSteps; i++) {
      const pricePct = i / priceSteps;
      const depth = Math.max(0, (market.totalVolume || 1000) * (1 - Math.abs(pricePct - yesPrice)) * 0.15);
      yesBids.push({ price: Math.round(pricePct * 100) / 100, depth: Math.round(depth * 100) / 100 });
    }

    for (let i = 1; i <= priceSteps; i++) {
      const pricePct = i / priceSteps;
      const depth = Math.max(0, (market.totalVolume || 1000) * (1 - Math.abs(pricePct - noPrice)) * 0.15);
      noBids.push({ price: Math.round(pricePct * 100) / 100, depth: Math.round(depth * 100) / 100 });
    }

    // Cumulative depth
    let cumYes = 0;
    const yesCumulative = yesBids.map((b) => { cumYes += b.depth; return { ...b, cumulative: Math.round(cumYes * 100) / 100 }; });
    let cumNo = 0;
    const noCumulative = noBids.map((b) => { cumNo += b.depth; return { ...b, cumulative: Math.round(cumNo * 100) / 100 }; });

    return {
      yes: yesCumulative,
      no: noCumulative,
      midpoint: Math.round(((yesPrice + (1 - noPrice)) / 2) * 100) / 100,
      spread: Math.round(Math.abs(yesPrice - (1 - noPrice)) * 100) / 100,
    };
  }
}

module.exports = LiquidityController;
