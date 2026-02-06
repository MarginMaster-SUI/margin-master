import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const copyTradesRouter: ReturnType<typeof Router> = Router();

// Get copy relations for a user (as follower)
copyTradesRouter.get('/my-relations/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress: address },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const relations = await prisma.copyRelation.findMany({
      where: { followerId: user.id },
      include: {
        trader: {
          select: {
            suiAddress: true,
            username: true,
            traderProfile: {
              select: { totalPnL: true, winRate: true, totalTrades: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      relations.map((r) => ({
        id: r.id,
        traderAddress: r.trader.suiAddress,
        traderUsername: r.trader.username,
        traderStats: r.trader.traderProfile,
        copyRatio: r.copyRatio,
        maxPositionSize: r.maxPositionSize,
        stopLossPercent: r.stopLossPercent,
        takeProfitPercent: r.takeProfitPercent,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching copy relations:', error);
    res.status(500).json({ error: 'Failed to fetch copy relations' });
  }
});

// Register copy relation (off-chain record)
copyTradesRouter.post('/register', async (req, res) => {
  try {
    const { traderAddress, followerAddress, copyRatio, maxPositionSize } = req.body;

    if (!traderAddress || !followerAddress || copyRatio == null) {
      return res.status(400).json({ error: 'traderAddress, followerAddress, and copyRatio are required' });
    }

    if (typeof copyRatio !== 'number' || copyRatio < 1 || copyRatio > 100) {
      return res.status(400).json({ error: 'copyRatio must be a number between 1 and 100' });
    }

    if (traderAddress === followerAddress) {
      return res.status(400).json({ error: 'Cannot copy trade yourself' });
    }

    // Find or create users
    const trader = await prisma.user.upsert({
      where: { suiAddress: traderAddress },
      create: { suiAddress: traderAddress, username: `trader_${traderAddress.slice(0, 8)}` },
      update: {},
    });

    const follower = await prisma.user.upsert({
      where: { suiAddress: followerAddress },
      create: { suiAddress: followerAddress, username: `user_${followerAddress.slice(0, 8)}` },
      update: {},
    });

    const relation = await prisma.copyRelation.upsert({
      where: {
        traderId_followerId: {
          traderId: trader.id,
          followerId: follower.id,
        },
      },
      create: {
        traderId: trader.id,
        followerId: follower.id,
        copyRatio: copyRatio / 100,
        maxPositionSize: maxPositionSize || null,
        isActive: true,
      },
      update: {
        copyRatio: copyRatio / 100,
        maxPositionSize: maxPositionSize || null,
        isActive: true,
      },
    });

    // Update follower count
    const followerCount = await prisma.copyRelation.count({
      where: { traderId: trader.id, isActive: true },
    });

    await prisma.traderProfile.upsert({
      where: { userId: trader.id },
      create: { userId: trader.id, followerCount },
      update: { followerCount },
    });

    res.json({ success: true, relationId: relation.id });
  } catch (error) {
    console.error('Error registering copy relation:', error);
    res.status(500).json({ error: 'Failed to register copy relation' });
  }
});

// Deactivate copy relation
copyTradesRouter.post('/deactivate/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.copyRelation.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating copy relation:', error);
    res.status(500).json({ error: 'Failed to deactivate copy relation' });
  }
});
