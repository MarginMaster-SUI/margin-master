import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('CopyRelation Model', () => {
  let traderId: string;
  let followerId: string;

  beforeAll(async () => {
    // Create test users
    const trader = await prisma.user.create({
      data: {
        suiAddress: '0xtrader456',
        username: 'mastertrader',
      },
    });

    const follower = await prisma.user.create({
      data: {
        suiAddress: '0xfollower789',
        username: 'copyfollower',
      },
    });

    traderId = trader.id;
    followerId = follower.id;
  });

  afterAll(async () => {
    await prisma.copyRelation.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.copyRelation.deleteMany();
  });

  test('should create copy relation between trader and follower', async () => {
    const relation = await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 1.0,
        isActive: true,
      },
    });

    expect(relation.id).toBeDefined();
    expect(relation.traderId).toBe(traderId);
    expect(relation.followerId).toBe(followerId);
    expect(relation.copyRatio).toBe(1.0);
    expect(relation.isActive).toBe(true);
    expect(relation.createdAt).toBeInstanceOf(Date);
    expect(relation.updatedAt).toBeInstanceOf(Date);
  });

  test('should prevent user from copying themselves', async () => {
    await expect(
      prisma.copyRelation.create({
        data: {
          traderId,
          followerId: traderId, // Same user
          copyRatio: 1.0,
        },
      })
    ).rejects.toThrow();
  });

  test('should enforce unique constraint on trader-follower pair', async () => {
    await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 0.5,
      },
    });

    // Try to create duplicate relation
    await expect(
      prisma.copyRelation.create({
        data: {
          traderId,
          followerId,
          copyRatio: 1.0,
        },
      })
    ).rejects.toThrow();
  });

  test('should support custom copy ratios', async () => {
    const relation = await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 0.25, // 25% of trader's position size
      },
    });

    expect(relation.copyRatio).toBe(0.25);
  });

  test('should validate copy ratio is between 0 and 1', async () => {
    // Copy ratio > 1 should fail
    await expect(
      prisma.copyRelation.create({
        data: {
          traderId,
          followerId,
          copyRatio: 1.5,
        },
      })
    ).rejects.toThrow();

    // Copy ratio < 0 should fail
    await expect(
      prisma.copyRelation.create({
        data: {
          traderId,
          followerId,
          copyRatio: -0.5,
        },
      })
    ).rejects.toThrow();
  });

  test('should set default values correctly', async () => {
    const relation = await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 1.0,
        // isActive should default to true
        // maxPositionSize should default to null
      },
    });

    expect(relation.isActive).toBe(true);
    expect(relation.maxPositionSize).toBeNull();
    expect(relation.stopLossPercent).toBeNull();
    expect(relation.takeProfitPercent).toBeNull();
  });

  test('should support optional risk management settings', async () => {
    const relation = await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 1.0,
        maxPositionSize: 10000,
        stopLossPercent: 5.0,
        takeProfitPercent: 10.0,
      },
    });

    expect(relation.maxPositionSize).toBe(10000);
    expect(relation.stopLossPercent).toBe(5.0);
    expect(relation.takeProfitPercent).toBe(10.0);
  });

  test('should allow pausing copy relation with isActive flag', async () => {
    const relation = await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 1.0,
        isActive: true,
      },
    });

    // Pause the relation
    const updated = await prisma.copyRelation.update({
      where: { id: relation.id },
      data: { isActive: false },
    });

    expect(updated.isActive).toBe(false);
  });

  test('should include trader and follower data when querying with relations', async () => {
    await prisma.copyRelation.create({
      data: {
        traderId,
        followerId,
        copyRatio: 0.75,
      },
    });

    const relation = await prisma.copyRelation.findFirst({
      where: { traderId },
      include: {
        trader: true,
        follower: true,
      },
    });

    expect(relation).toBeDefined();
    expect(relation?.trader.id).toBe(traderId);
    expect(relation?.trader.suiAddress).toBe('0xtrader456');
    expect(relation?.follower.id).toBe(followerId);
    expect(relation?.follower.suiAddress).toBe('0xfollower789');
  });

  test('should cascade delete when trader is deleted', async () => {
    // Create separate trader for cascade test
    const tempTrader = await prisma.user.create({
      data: {
        suiAddress: '0xtemptrader',
        username: 'temptrader',
      },
    });

    await prisma.copyRelation.create({
      data: {
        traderId: tempTrader.id,
        followerId,
        copyRatio: 1.0,
      },
    });

    // Delete trader should cascade to relations
    await prisma.user.delete({
      where: { id: tempTrader.id },
    });

    const deletedRelation = await prisma.copyRelation.findFirst({
      where: { traderId: tempTrader.id },
    });

    expect(deletedRelation).toBeNull();
  });

  test('should cascade delete when follower is deleted', async () => {
    // Create separate follower for cascade test
    const tempFollower = await prisma.user.create({
      data: {
        suiAddress: '0xtempfollower',
        username: 'tempfollower',
      },
    });

    await prisma.copyRelation.create({
      data: {
        traderId,
        followerId: tempFollower.id,
        copyRatio: 1.0,
      },
    });

    // Delete follower should cascade to relations
    await prisma.user.delete({
      where: { id: tempFollower.id },
    });

    const deletedRelation = await prisma.copyRelation.findFirst({
      where: { followerId: tempFollower.id },
    });

    expect(deletedRelation).toBeNull();
  });

  test('should query all followers of a trader', async () => {
    // Create multiple followers
    const follower2 = await prisma.user.create({
      data: {
        suiAddress: '0xfollower2',
        username: 'follower2',
      },
    });

    await prisma.copyRelation.createMany({
      data: [
        {
          traderId,
          followerId,
          copyRatio: 0.5,
        },
        {
          traderId,
          followerId: follower2.id,
          copyRatio: 1.0,
        },
      ],
    });

    const relations = await prisma.copyRelation.findMany({
      where: { traderId, isActive: true },
      include: { follower: true },
    });

    expect(relations).toHaveLength(2);
    expect(relations[0].follower).toBeDefined();
    expect(relations[1].follower).toBeDefined();
  });

  test('should query all traders a user is following', async () => {
    // Create another trader
    const trader2 = await prisma.user.create({
      data: {
        suiAddress: '0xtrader2',
        username: 'trader2',
      },
    });

    await prisma.copyRelation.createMany({
      data: [
        {
          traderId,
          followerId,
          copyRatio: 0.5,
        },
        {
          traderId: trader2.id,
          followerId,
          copyRatio: 0.75,
        },
      ],
    });

    const relations = await prisma.copyRelation.findMany({
      where: { followerId, isActive: true },
      include: { trader: true },
    });

    expect(relations).toHaveLength(2);
    expect(relations[0].trader).toBeDefined();
    expect(relations[1].trader).toBeDefined();
  });
});
