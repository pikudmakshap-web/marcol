const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes.js');
const userRoutes = require('./routes/user.routes.js');
const walletRoutes = require('./routes/wallet.routes.js');
const productRoutes = require('./routes/product.routes.js');
const transactionRoutes = require('./routes/transaction.routes.js');
const reportRoutes = require('./routes/report.routes.js');
const messageRoutes = require('./routes/messages.routes.js');
const dashboardRoutes = require('./routes/dashboard.routes.js');
const settingsRoutes = require('./routes/settings.routes.js');
const categoryRoutes = require('./routes/category.routes.js');
const { errorHandler } = require('./middleware/errorHandler.js');
const logger = require('./utils/logger.js');
const createAdmin = require('../scripts/createAdmin.js');
const { initSocket } = require('./socket.js');
const { ensureMainDatabaseExists, disconnectPrismaClients } = require('./config/database.js');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// createAdmin()
const environmentsRoutes = require('./routes/environments.routes.js');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/environments', environmentsRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await ensureMainDatabaseExists();
    logger.info('Ensured main database exists');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error(`Failed to ensure main database: ${error.message}`);
    process.exit(1);
  }
}

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down server...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      await disconnectPrismaClients();
      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error(`Shutdown failed: ${error.message}`);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
startServer();

module.exports = app;
