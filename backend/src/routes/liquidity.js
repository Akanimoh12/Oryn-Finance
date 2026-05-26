const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const LiquidityController = require('../controllers/liquidityController');

// GET /api/liquidity/stats — platform-wide liquidity summary
router.get('/stats', asyncHandler(LiquidityController.getStats));

// GET /api/liquidity/pools — paginated pool list
router.get('/pools', asyncHandler(LiquidityController.getPools));

// GET /api/liquidity/pools/:marketId — single pool with APY + depth
router.get('/pools/:marketId', asyncHandler(LiquidityController.getPool));

// GET /api/liquidity/pools/:marketId/depth — depth chart only
router.get('/pools/:marketId/depth', asyncHandler(LiquidityController.getDepthChart));

module.exports = router;
