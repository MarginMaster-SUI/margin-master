import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const leaderboardRouter: ReturnType<typeof Router> = Router();

leaderboardRouter.get('/', async (req, res) => {
  try {
    const { sortBy = 'totalPnL', order = 'desc', limit = '50' } = req.query;

    const validSortFields: Record<string, string> = {
      totalPnL: 'totalPnL',
      winRate: 'winRate',
      totalTrades: 'totalTrades',
      followerCount: 'followerCount',
    };

    const sortField = validSortFields[sortBy as string] || 'totalPnL';

    const traders = await prisma.traderProfile.findMany({
      where: { isPublic: true },
      include: {
        user: {
          select: {
            suiAddress: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' },
      take: Math.min(Number(limit), 100),
    });

    const result = traders.map((trader, index) => ({
      rank: index + 1,
      address: trader.user.suiAddress,
      username: trader.user.username,
      avatarUrl: trader.user.avatarUrl,
      totalPnL: trader.totalPnL,
      winRate: trader.winRate,
      totalTrades: trader.totalTrades,
      followerCount: trader.followerCount,
      sharpeRatio: trader.sharpeRatio,
      maxDrawdown: trader.maxDrawdown,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});
