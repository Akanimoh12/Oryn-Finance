const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser'); // Issue #22: parse httpOnly cookies
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./src/config/database');
const logger = require('./src/config/logger');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// Import routes
const authRoutes = require('./src/routes/auth');       // Issue #22: httpOnly cookie auth
const healthRoutes = require('./src/routes/health');
const marketRoutes = require('./src/routes/markets');
const tradeRoutes = require('./src/routes/trades');
const transactionRoutes = require('./src/routes/transactions');
const userRoutes = require('./src/routes/users');
const leaderboardRoutes = require('./src/routes/leaderboard');
const analyticsRoutes = require('./src/routes/analytics');
const adminRoutes = require('./src/routes/admin');
const oracleRoutes = require('./src/routes/oracle');
const liquidityRoutes = require('./src/routes/liquidity');

// Import services
const backgroundJobs = require('./src/services/backgroundJobs');
const websocketHandler = require('./src/services/websocketHandler');
const contractEventIndexer = require('./src/services/contractEventIndexer');
const transactionRetryQueue = require('./src/services/transactionRetryQueue'); // Issue #23

class OrynBackendServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    this.port = process.env.PORT || 5001;
  }

  async initialize() {
    try {
      // Connect to database (optional for now)
      try {
        await connectDB();
        logger.info('Database connected successfully');
      } catch (dbError) {
        logger.warn('Database connection skipped:', dbError.message);
        logger.warn('Server will run without database functionality');
      }

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup WebSocket handlers
      this.setupWebSocket();

      // Setup error handling
      this.setupErrorHandling();

      // Start background jobs
      this.startBackgroundJobs();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'https://oryn.finance'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Stricter rate limiting for trading endpoints
    const tradeLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 trades per minute
      message: 'Trading rate limit exceeded, please slow down.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/trades', tradeLimiter);

    // Body parser middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser — required for httpOnly JWT cookie support (Issue #22)
    this.app.use(cookieParser());

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: { write: message => logger.info(message.trim()) }
      }));
    }

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = Math.random().toString(36).substring(2, 15);
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Request timing middleware
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
      });
      next();
    });
  }

  setupRoutes() {
    // Auth routes — refresh token, logout (Issue #22)
    this.app.use('/api/auth', authRoutes);

    // Health check (no authentication required)
    this.app.use('/api/health', healthRoutes);

    // Public routes
    this.app.use('/api/markets', marketRoutes);
    this.app.use('/api/oracle', oracleRoutes);
    this.app.use('/api/leaderboard', leaderboardRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/liquidity', liquidityRoutes);

    // Transaction routes (mixed auth - some endpoints require auth, others don't)
    this.app.use('/api/transactions', transactionRoutes);

    // Protected routes
    this.app.use('/api/trades', tradeRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/admin', adminRoutes);

    // API documentation
    if (process.env.NODE_ENV !== 'production') {
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('./src/config/swagger');
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    }

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Oryn Finance Backend API',
        version: '1.0.0',
        status: 'running',
        docs: process.env.NODE_ENV !== 'production' ? '/api-docs' : undefined
      });
    });
  }

  setupWebSocket() {
    websocketHandler.initialize(this.io);

    // Issue #23: inject Socket.io into the retry queue so it can notify users
    transactionRetryQueue.injectIo(this.io);

    logger.info('WebSocket handlers initialized');
  }

  setupErrorHandling() {
    this.app.use(notFound);
    this.app.use(errorHandler);

    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Uncaught exception
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  startBackgroundJobs() {
    if (process.env.NODE_ENV !== 'test') {
      // Start traditional background jobs
      backgroundJobs.start();
      logger.info('Background jobs started');

      // Start contract event indexer
      try {
        contractEventIndexer.start();
        logger.info('Contract event indexer started');
      } catch (error) {
        logger.warn('Failed to start contract event indexer:', error.message);
        logger.warn('Contract event indexing will be disabled');
      }
    }
  }

  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      this.server.close(() => {
        logger.info('HTTP server closed');

        // Close database connection
        require('mongoose').connection.close(() => {
          logger.info('MongoDB connection closed');

          // Stop background jobs
          backgroundJobs.stop();
          logger.info('Background jobs stopped');

          // Stop contract event indexer
          try {
            contractEventIndexer.stop();
            logger.info('Contract event indexer stopped');
          } catch (error) {
            logger.warn('Error stopping contract event indexer:', error.message);
          }

          logger.info('Graceful shutdown completed');
          process.exit(0);
        });
      });

      // Force close server after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  start() {
    this.server.listen(this.port, () => {
      logger.info(`Oryn Finance Backend running on port ${this.port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`API Documentation: http://localhost:${this.port}/api-docs`);
      }
    });
  }
}

// Initialize and start server
if (require.main === module) {
  const server = new OrynBackendServer();
  server.initialize().then(() => {
    server.start();
  }).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = OrynBackendServer;