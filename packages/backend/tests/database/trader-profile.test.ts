import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('TraderProfile Model', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xtrader123',
        username: 'testtrader',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.traderProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.traderProfile.deleteMany();
  });

  test('should create trader profile with user relationship', async () => {
    const profile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        isPublic: true,
      },
    });

    expect(profile.id).toBeDefined();
    expect(profile.userId).toBe(testUserId);
    expect(profile.totalTrades).toBe(0);
    expect(profile.winRate).toBe(0);
    expect(profile.totalPnL).toBe(0);
    expect(profile.isPublic).toBe(true);
    expect(profile.createdAt).toBeInstanceOf(Date);
    expect(profile.updatedAt).toBeInstanceOf(Date);
  });

  test('should enforce unique constraint on userId (one profile per user)', async () => {
    await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 10,
        winRate: 75.5,
        totalPnL: 1000,
      },
    });

    await expect(
      prisma.traderProfile.create({
        data: {
          userId: testUserId,
          totalTrades: 5,
          winRate: 50,
          totalPnL: 500,
        },
      })
    ).rejects.toThrow();
  });

  test('should track performance metrics correctly', async () => {
    const profile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 100,
        winRate: 65.5,
        totalPnL: 5000.75,
        avgTradeSize: 250.5,
        maxDrawdown: 15.25,
      },
    });

    expect(profile.totalTrades).toBe(100);
    expect(profile.winRate).toBe(65.5);
    expect(profile.totalPnL).toBe(5000.75);
    expect(profile.avgTradeSize).toBe(250.5);
    expect(profile.maxDrawdown).toBe(15.25);
  });

  test('should support optional performance metrics', async () => {
    const profile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        // avgTradeSize, maxDrawdown, sharpeRatio are optional
      },
    });

    expect(profile.avgTradeSize).toBeNull();
    expect(profile.maxDrawdown).toBeNull();
    expect(profile.sharpeRatio).toBeNull();
  });

  test('should set default values correctly', async () => {
    const profile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        // isPublic should default to true
        // followerCount should default to 0
      },
    });

    expect(profile.isPublic).toBe(true);
    expect(profile.followerCount).toBe(0);
  });

  test('should allow privacy control with isPublic flag', async () => {
    const privateProfile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 50,
        winRate: 80,
        totalPnL: 10000,
        isPublic: false,
      },
    });

    expect(privateProfile.isPublic).toBe(false);
  });

  test('should track follower count', async () => {
    const profile = await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        followerCount: 150,
      },
    });

    expect(profile.followerCount).toBe(150);

    // Update follower count
    const updated = await prisma.traderProfile.update({
      where: { id: profile.id },
      data: { followerCount: 200 },
    });

    expect(updated.followerCount).toBe(200);
  });

  test('should include user data when querying with relations', async () => {
    await prisma.traderProfile.create({
      data: {
        userId: testUserId,
        totalTrades: 25,
        winRate: 70,
        totalPnL: 2500,
      },
    });

    const profile = await prisma.traderProfile.findFirst({
      where: { userId: testUserId },
      include: { user: true },
    });

    expect(profile).toBeDefined();
    expect(profile?.user.id).toBe(testUserId);
    expect(profile?.user.suiAddress).toBe('0xtrader123');
    expect(profile?.user.username).toBe('testtrader');
  });

  test('should cascade delete when user is deleted', async () => {
    // Create a separate user and profile for cascade test
    const tempUser = await prisma.user.create({
      data: {
        suiAddress: '0xtemp123',
        username: 'tempuser',
      },
    });

    await prisma.traderProfile.create({
      data: {
        userId: tempUser.id,
        totalTrades: 10,
        winRate: 60,
        totalPnL: 1000,
      },
    });

    // Delete user should cascade to profile
    await prisma.user.delete({
      where: { id: tempUser.id },
    });

    const deletedProfile = await prisma.traderProfile.findFirst({
      where: { userId: tempUser.id },
    });

    expect(deletedProfile).toBeNull();
  });
});
