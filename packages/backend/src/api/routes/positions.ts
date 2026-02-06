import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const positionsRouter: ReturnType<typeof Router> = Router();

// Get positions for a user
positionsRouter.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { status = 'OPEN' } = req.query;

    const user = await prisma.user.findUnique({
      where: { suiAddress: address },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        ...(status !== 'ALL' ? { status: status as string } : {}),
      },
      include: {
        tradingPair: { select: { symbol: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    res.json(
      positions.map((p) => ({
        id: p.id,
        pair: p.tradingPair.symbol,
        positionType: p.positionType,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        quantity: p.quantity,
        leverage: p.leverage,
        margin: p.margin,
        unrealizedPnL: p.unrealizedPnL,
        realizedPnL: p.realizedPnL,
        stopLossPrice: p.stopLossPrice,
        takeProfitPrice: p.takeProfitPrice,
        status: p.status,
        isCopyTrade: p.isCopyTrade,
        onChainPositionId: p.onChainPositionId,
        openedAt: p.openedAt,
        closedAt: p.closedAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Get notifications for a user
positionsRouter.get('/:address/notifications', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress: address },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});
