import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const tradersRouter: ReturnType<typeof Router> = Router();

// Get trader stats by address
tradersRouter.get('/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress: address },
      include: {
        traderProfile: true,
        tradingRelations: {
          where: { isActive: true },
          select: {
            id: true,
            followerId: true,
            copyRatio: true,
            follower: {
              select: { suiAddress: true, username: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    // Get recent trades
    const recentTrades = await prisma.trade.findMany({
      where: { userId: user.id },
      include: {
        tradingPair: { select: { symbol: true } },
      },
      orderBy: { executedAt: 'desc' },
      take: 20,
    });

    res.json({
      address: user.suiAddress,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      profile: user.traderProfile,
      followers: user.tradingRelations.map((r) => ({
        address: r.follower.suiAddress,
        username: r.follower.username,
        copyRatio: r.copyRatio,
      })),
      recentTrades: recentTrades.map((t) => ({
        id: t.id,
        pair: t.tradingPair.symbol,
        side: t.side,
        tradeType: t.tradeType,
        price: t.price,
        quantity: t.quantity,
        pnl: t.pnl,
        executedAt: t.executedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching trader stats:', error);
    res.status(500).json({ error: 'Failed to fetch trader stats' });
  }
});
