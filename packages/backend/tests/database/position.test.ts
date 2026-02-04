import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Position Model', () => {
  let testUserId: string;
  let testTradingPairId: string;
  let testCopyRelationId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xposition_test_user',
        username: 'positiontester',
      },
    });
    testUserId = user.id;

    // Create test trading pair
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'BTC/USDC',
        baseAsset: 'BTC',
        quoteAsset: 'USDC',
        minQuantity: 0.001,
        maxLeverage: 10,
      },
    });
    testTradingPairId = pair.id;

    // Create trader and follower for copy relation
    const trader = await prisma.user.create({
      data: {
        suiAddress: '0xtrader_pos',
        username: 'traderpos',
      },
    });

    const follower = await prisma.user.create({
      data: {
        suiAddress: '0xfollower_pos',
        username: 'followerpos',
      },
    });

    const copyRelation = await prisma.copyRelation.create({
      data: {
        traderId: trader.id,
        followerId: follower.id,
        copyRatio: 0.5,
      },
    });
    testCopyRelationId = copyRelation.id;
  });

  afterAll(async () => {
    await prisma.position.deleteMany();
    await prisma.copyRelation.deleteMany();
    await prisma.tradingPair.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.position.deleteMany({
      where: { userId: testUserId },
    });
  });

  test('should create LONG position', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    expect(position.id).toBeDefined();
    expect(position.userId).toBe(testUserId);
    expect(position.positionType).toBe('LONG');
    expect(position.entryPrice).toBe(50000);
    expect(position.quantity).toBe(0.1);
    expect(position.leverage).toBe(5);
    expect(position.margin).toBe(1000);
    expect(position.status).toBe('OPEN');
    expect(position.isCopyTrade).toBe(false);
    expect(position.openedAt).toBeInstanceOf(Date);
  });

  test('should create SHORT position', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'SHORT',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 3,
        margin: 1666.67,
      },
    });

    expect(position.positionType).toBe('SHORT');
    expect(position.leverage).toBe(3);
  });

  test('should set default status to OPEN', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    expect(position.status).toBe('OPEN');
  });

  test('should support stop-loss and take-profit prices', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
        stopLossPrice: 48000,
        takeProfitPrice: 55000,
      },
    });

    expect(position.stopLossPrice).toBe(48000);
    expect(position.takeProfitPrice).toBe(55000);
  });

  test('should track copy trade metadata', async () => {
    const originalPosition = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    const copyPosition = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.05,
        leverage: 5,
        margin: 500,
        isCopyTrade: true,
        originalPositionId: originalPosition.id,
        copyRelationId: testCopyRelationId,
      },
    });

    expect(copyPosition.isCopyTrade).toBe(true);
    expect(copyPosition.originalPositionId).toBe(originalPosition.id);
    expect(copyPosition.copyRelationId).toBe(testCopyRelationId);
  });

  test('should update position to CLOSED status', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    const closed = await prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
        currentPrice: 52000,
        realizedPnL: 2000,
        closedAt: new Date(),
      },
    });

    expect(closed.status).toBe('CLOSED');
    expect(closed.currentPrice).toBe(52000);
    expect(closed.realizedPnL).toBe(2000);
    expect(closed.closedAt).toBeInstanceOf(Date);
  });

  test('should track unrealized PnL for open positions', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
        currentPrice: 51000,
        unrealizedPnL: 500,
      },
    });

    expect(position.unrealizedPnL).toBe(500);
    expect(position.currentPrice).toBe(51000);
  });

  test('should support LIQUIDATED status', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 10,
        margin: 500,
        status: 'LIQUIDATED',
        currentPrice: 45000,
        realizedPnL: -500,
        closedAt: new Date(),
      },
    });

    expect(position.status).toBe('LIQUIDATED');
    expect(position.realizedPnL).toBe(-500);
  });

  test('should include user and trading pair when querying with relations', async () => {
    await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    const position = await prisma.position.findFirst({
      where: { userId: testUserId },
      include: {
        user: true,
        tradingPair: true,
      },
    });

    expect(position).toBeDefined();
    expect(position?.user.id).toBe(testUserId);
    expect(position?.tradingPair.id).toBe(testTradingPairId);
    expect(position?.tradingPair.symbol).toBe('BTC/USDC');
  });

  test('should cascade delete when user is deleted', async () => {
    const tempUser = await prisma.user.create({
      data: {
        suiAddress: '0xtemp_pos_user',
        username: 'tempposuser',
      },
    });

    await prisma.position.create({
      data: {
        userId: tempUser.id,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
      },
    });

    await prisma.user.delete({
      where: { id: tempUser.id },
    });

    const deletedPosition = await prisma.position.findFirst({
      where: { userId: tempUser.id },
    });

    expect(deletedPosition).toBeNull();
  });

  test('should track on-chain position ID', async () => {
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 50000,
        quantity: 0.1,
        leverage: 5,
        margin: 1000,
        onChainPositionId: '0x123abc',
        txHash: '0xdef456',
      },
    });

    expect(position.onChainPositionId).toBe('0x123abc');
    expect(position.txHash).toBe('0xdef456');
  });

  test('should query all open positions for a user', async () => {
    await prisma.position.createMany({
      data: [
        {
          userId: testUserId,
          tradingPairId: testTradingPairId,
          positionType: 'LONG',
          entryPrice: 50000,
          quantity: 0.1,
          leverage: 5,
          margin: 1000,
          status: 'OPEN',
        },
        {
          userId: testUserId,
          tradingPairId: testTradingPairId,
          positionType: 'SHORT',
          entryPrice: 51000,
          quantity: 0.05,
          leverage: 3,
          margin: 850,
          status: 'OPEN',
        },
        {
          userId: testUserId,
          tradingPairId: testTradingPairId,
          positionType: 'LONG',
          entryPrice: 49000,
          quantity: 0.2,
          leverage: 5,
          margin: 1960,
          status: 'CLOSED',
          closedAt: new Date(),
        },
      ],
    });

    const openPositions = await prisma.position.findMany({
      where: {
        userId: testUserId,
        status: 'OPEN',
      },
    });

    expect(openPositions).toHaveLength(2);
    expect(openPositions.every((p) => p.status === 'OPEN')).toBe(true);
  });
});
