const jwt = require('jsonwebtoken');
const StellarSdk = require('stellar-sdk');
const logger = require('../config/logger');
// const { User } = require('../models'); // Temporarily disabled for non-DB mode

const REFRESH_TOKEN_EXPIRY = '30d';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

// ── Cookie helpers (Issue #22) ────────────────────────────────────────────────

const COOKIE_ACCESS  = 'oryn_access';
const COOKIE_REFRESH = 'oryn_refresh';
const IS_PROD        = process.env.NODE_ENV === 'production';

/**
 * Write access + refresh tokens into httpOnly, SameSite=Strict cookies.
 * httpOnly prevents JS access (XSS mitigation).
 * Secure flag is set in production so cookies travel only over HTTPS.
 */
function setAuthCookies(res, { accessToken, refreshToken }) {
  const base = { httpOnly: true, sameSite: 'strict', secure: IS_PROD };
  res.cookie(COOKIE_ACCESS,  accessToken,  { ...base, maxAge: 15 * 60 * 1000 });         // 15 min
  res.cookie(COOKIE_REFRESH, refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
}

/**
 * Clear both auth cookies (called on logout).
 */
function clearAuthCookies(res) {
  const base = { httpOnly: true, sameSite: 'strict', secure: IS_PROD };
  res.clearCookie(COOKIE_ACCESS,  base);
  res.clearCookie(COOKIE_REFRESH, base);
}

class AuthMiddleware {
  static async authenticateToken(req, res, next) {
    try {
      // Accept token from httpOnly cookie first, then fall back to Bearer header
      const cookieToken = req.cookies?.[COOKIE_ACCESS];
      const authHeader  = req.headers['authorization'];
      const headerToken = authHeader && authHeader.split(' ')[1];
      const token       = cookieToken || headerToken;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      // TEMPORARY: For testing, if token looks like a Stellar public key, use it directly
      if (StellarSdk.StrKey.isValidEd25519PublicKey(token)) {
        logger.info('Using wallet address directly for auth (testing mode)', {
          walletAddress: token.substring(0, 10) + '...'
        });

        req.user = {
          walletAddress: token.toLowerCase(),
          userId: token.toLowerCase(),
          userData: {
            walletAddress: token.toLowerCase(),
            username: null,
            isAdmin: false,
            level: 1,
            lastActiveAt: new Date()
          }
        };

        return next();
      }

      // Try to decode as JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verify the wallet address exists and is valid
      if (!decoded.walletAddress || !StellarSdk.StrKey.isValidEd25519PublicKey(decoded.walletAddress)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token: wallet address missing or invalid'
        });
      }

      // For non-DB mode, create a minimal user object from token
      const user = {
        walletAddress: decoded.walletAddress.toLowerCase(),
        username: decoded.username || null,
        isAdmin: decoded.isAdmin || false,
        level: decoded.level || 1,
        lastActiveAt: new Date()
      };

      // For non-DB mode, skip suspension checks

      // Attach user info to request
      req.user = {
        walletAddress: decoded.walletAddress.toLowerCase(),
        userId: decoded.walletAddress.toLowerCase(), // Use wallet address as ID in non-DB mode
        userData: user
      };

      logger.info('User authenticated (non-DB mode)', {
        walletAddress: req.user.walletAddress
      });

      next();
    } catch (error) {
      logger.error('Authentication failed:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }

  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        req.user = null;
        return next();
      }

      // Use the same authentication logic but don't fail if token is invalid
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.walletAddress && StellarSdk.StrKey.isValidEd25519PublicKey(decoded.walletAddress)) {
        // For non-DB mode, create minimal user object
        const user = {
          walletAddress: decoded.walletAddress.toLowerCase(),
          isAdmin: decoded.isAdmin || false
        };
        
        req.user = {
          walletAddress: decoded.walletAddress.toLowerCase(),
          userId: decoded.walletAddress.toLowerCase(),
          userData: user
        };
      }

      next();
    } catch (error) {
      // For optional auth, continue without user if token is invalid
      req.user = null;
      next();
    }
  }

  static requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Accept admin role from JWT claim OR from ADMIN_ADDRESSES env list
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.trim().toLowerCase()).filter(Boolean);
    const isAdminByAddress = adminAddresses.includes(req.user.walletAddress);
    const isAdminByJwtRole = req.user.userData?.isAdmin === true;

    if (!isAdminByAddress && !isAdminByJwtRole) {
      logger.warn('Admin access denied', {
        walletAddress: req.user.walletAddress,
        jwtRole: isAdminByJwtRole,
        addressMatch: isAdminByAddress,
      });

      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    logger.info('Admin access granted', {
      walletAddress: req.user.walletAddress,
      via: isAdminByJwtRole ? 'jwt-role' : 'address-list',
    });

    next();
  }

  static requireMarketCreator(req, res, next) {
    // This middleware checks if the user is the creator of a specific market
    // The market ID should be in req.params.id or req.params.marketId
    const marketId = req.params.id || req.params.marketId;
    
    if (!marketId) {
      return res.status(400).json({
        success: false,
        message: 'Market ID required'
      });
    }

    // The actual market creator check would be done in the route handler
    // This middleware just ensures we have the market ID
    req.marketId = marketId;
    next();
  }

  static checkRateLimit(windowMs, maxRequests, message = 'Rate limit exceeded') {
    const requests = new Map();
    
    return (req, res, next) => {
      const identifier = req.user?.walletAddress || req.ip;
      const now = Date.now();
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }
      
      const userRequests = requests.get(identifier);
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
      
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
        });
      }
      
      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      next();
    };
  }
}

// JWT Token Generation
class TokenService {
  static generateToken(walletAddress, expiresIn = '7d', extra = {}) {
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const payload = {
      walletAddress: walletAddress.toLowerCase(),
      isAdmin: adminAddresses.includes(walletAddress.toLowerCase()),
      iat: Math.floor(Date.now() / 1000),
      ...extra,
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  static generateAccessToken(walletAddress) {
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const payload = {
      walletAddress: walletAddress.toLowerCase(),
      isAdmin: adminAddresses.includes(walletAddress.toLowerCase()),
      tokenType: 'access',
      iat: Math.floor(Date.now() / 1000),
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  static generateRefreshToken(walletAddress) {
    const payload = {
      walletAddress: walletAddress.toLowerCase(),
      tokenType: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  }

  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      if (decoded.tokenType !== 'refresh') {
        return null;
      }
      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  static async rotateTokens(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    const accessToken = this.generateAccessToken(decoded.walletAddress);
    const newRefreshToken = this.generateRefreshToken(decoded.walletAddress);

    logger.auth('Tokens rotated', { walletAddress: decoded.walletAddress });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    };
  }

  static async generateAuthToken(walletAddress, signature, challenge) {
    try {
      // Verify the signature
      const isValid = await this.verifySignature(walletAddress, signature, challenge);
      
      if (!isValid) {
        throw new Error('Invalid signature');
      }

      const token = this.generateToken(walletAddress);
      
      logger.auth('Auth token generated', {
        walletAddress: walletAddress.toLowerCase()
      });

      return {
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };
    } catch (error) {
      logger.error('Failed to generate auth token:', error);
      throw error;
    }
  }

  static async verifySignature(walletAddress, signature, message) {
    try {
      // Verify that the signature was created by the wallet address
      const keypair = StellarSdk.Keypair.fromPublicKey(walletAddress);
      
      // In a real implementation, you would verify the signature here
      // This is a simplified check - actual implementation would verify
      // the Ed25519 signature using the Stellar SDK
      
      // For now, we'll assume the signature is valid if all parameters are present
      return signature && message && walletAddress;
    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }

  static async createChallenge(walletAddress) {
    const challenge = `Sign this message to authenticate with Oryn Finance: ${Date.now()}-${Math.random()}`;
    
    // In a production environment, you'd store this challenge temporarily
    // and verify it when the signature is provided
    
    return {
      challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };
  }
}

module.exports = {
  authenticateToken: AuthMiddleware.authenticateToken,
  optionalAuth: AuthMiddleware.optionalAuth,
  requireAdmin: AuthMiddleware.requireAdmin,
  requireMarketCreator: AuthMiddleware.requireMarketCreator,
  checkRateLimit: AuthMiddleware.checkRateLimit,
  setAuthCookies,
  clearAuthCookies,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  TokenService
};