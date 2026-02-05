/**
 * MarginMaster Backend - API Server + WebSocket + Event Indexer
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { prisma } from './lib/prisma.js';
import { leaderboardRouter } from './api/routes/leaderboard.js';
import { tradersRouter } from './api/routes/traders.js';
import { copyTradesRouter } from './api/routes/copy-trades.js';
import { positionsRouter } from './api/routes/positions.js';
import pino from 'pino';

const logger = pino({ name: 'server' });
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Rate limiting - 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/traders', tradersRouter);
app.use('/api/copy-trades', copyTradesRouter);
app.use('/api/positions', positionsRouter);

// Socket.IO events
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('subscribe-prices', () => {
    socket.join('price-updates');
  });

  socket.on('subscribe-positions', (userAddress: string) => {
    socket.join(`user:${userAddress}`);
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Simulated price feed (for demo)
const INITIAL_PRICES: Record<string, number> = {
  'SUI/USDC': 3.45,
  'BTC/USDC': 98500,
  'ETH/USDC': 3420,
};

// Allow prices to drift at most +/-20% from initial value
const PRICE_DRIFT_LIMIT = 0.2;

const basePrices: Record<string, number> = { ...INITIAL_PRICES };

setInterval(() => {
  for (const [pair, basePrice] of Object.entries(basePrices)) {
    const variation = (Math.random() - 0.5) * 0.002; // 0.1% variation
    let newPrice = basePrice * (1 + variation);

    // Clamp price within drift bounds
    const initial = INITIAL_PRICES[pair];
    const min = initial * (1 - PRICE_DRIFT_LIMIT);
    const max = initial * (1 + PRICE_DRIFT_LIMIT);
    newPrice = Math.max(min, Math.min(max, newPrice));

    basePrices[pair] = newPrice;

    io.to('price-updates').emit('price-update', {
      pair,
      price: parseFloat(newPrice.toFixed(pair === 'BTC/USDC' ? 2 : 4)),
      change24h: parseFloat(((Math.random() - 0.3) * 10).toFixed(2)),
      volume24h: Math.floor(Math.random() * 10_000_000),
    });
  }
}, 3000);

// Export io for use in other modules
export { io };

// Start server
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'MarginMaster API server started');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
