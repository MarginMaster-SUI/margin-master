import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Trade Model', () => {
  let testUserId: string;
  let testTradingPairId: string;
  let testPositionId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xtrade_test_user',
        username: 'tradetester',
      },
    });
    testUserId = user.id;

    // Create test trading pair
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'ETH/USDC',
        baseAsset: 'ETH',
        quoteAsset: 'USDC',
        minQuantity: 0.01,
        maxLeverage: 10,
      },
    });
    testTradingPairId = pair.id;

    // Create test position
    const position = await prisma.position.create({
      data: {
        userId: testUserId,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 3000,
        quantity: 1,
        leverage: 5,
        margin: 600,
      },
    });
    testPositionId = position.id;
  });

  afterAll(async () => {
    await prisma.trade.deleteMany();
    await prisma.position.deleteMany();
    await prisma.tradingPair.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.trade.deleteMany();
  });

  test('should record OPEN trade', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'OPEN',
        side: 'LONG',
        price: 3000,
        quantity: 1,
        value: 3000,
        fee: 3,
        txHash: '0xabc123',
      },
    });

    expect(trade.id).toBeDefined();
    expect(trade.tradeType).toBe('OPEN');
    expect(trade.side).toBe('LONG');
    expect(trade.price).toBe(3000);
    expect(trade.quantity).toBe(1);
    expect(trade.value).toBe(3000);
    expect(trade.fee).toBe(3);
    expect(trade.txHash).toBe('0xabc123');
    expect(trade.executedAt).toBeInstanceOf(Date);
  });

  test('should record CLOSE trade with PnL', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'CLOSE',
        side: 'LONG',
        price: 3200,
        quantity: 1,
        value: 3200,
        fee: 3.2,
        pnl: 200,
        txHash: '0xdef456',
      },
    });

    expect(trade.tradeType).toBe('CLOSE');
    expect(trade.pnl).toBe(200);
  });

  test('should record PARTIAL_CLOSE trade', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'PARTIAL_CLOSE',
        side: 'LONG',
        price: 3100,
        quantity: 0.5,
        value: 1550,
        fee: 1.55,
        pnl: 50,
        txHash: '0xghi789',
      },
    });

    expect(trade.tradeType).toBe('PARTIAL_CLOSE');
    expect(trade.quantity).toBe(0.5);
    expect(trade.pnl).toBe(50);
  });

  test('should record LIQUIDATION trade', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'LIQUIDATION',
        side: 'LONG',
        price: 2400,
        quantity: 1,
        value: 2400,
        fee: 0,
        pnl: -600,
        txHash: '0xjkl012',
      },
    });

    expect(trade.tradeType).toBe('LIQUIDATION');
    expect(trade.pnl).toBe(-600);
  });

  test('should track SHORT side trades', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'OPEN',
        side: 'SHORT',
        price: 3000,
        quantity: 1,
        value: 3000,
        fee: 3,
        txHash: '0xmno345',
      },
    });

    expect(trade.side).toBe('SHORT');
  });

  test('should include position data when querying with relations', async () => {
    await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'OPEN',
        side: 'LONG',
        price: 3000,
        quantity: 1,
        value: 3000,
        fee: 3,
        txHash: '0xpqr678',
      },
    });

    const trade = await prisma.trade.findFirst({
      where: { positionId: testPositionId },
      include: {
        position: true,
        user: true,
        tradingPair: true,
      },
    });

    expect(trade).toBeDefined();
    expect(trade?.position.id).toBe(testPositionId);
    expect(trade?.user.id).toBe(testUserId);
    expect(trade?.tradingPair.symbol).toBe('ETH/USDC');
  });

  test('should cascade delete when position is deleted', async () => {
    const tempUser = await prisma.user.create({
      data: {
        suiAddress: '0xtemp_trade_user',
        username: 'temptradeuser',
      },
    });

    const tempPosition = await prisma.position.create({
      data: {
        userId: tempUser.id,
        tradingPairId: testTradingPairId,
        positionType: 'LONG',
        entryPrice: 3000,
        quantity: 1,
        leverage: 5,
        margin: 600,
      },
    });

    await prisma.trade.create({
      data: {
        positionId: tempPosition.id,
        userId: tempUser.id,
        tradingPairId: testTradingPairId,
        tradeType: 'OPEN',
        side: 'LONG',
        price: 3000,
        quantity: 1,
        value: 3000,
        fee: 3,
        txHash: '0xstu901',
      },
    });

    await prisma.position.delete({
      where: { id: tempPosition.id },
    });

    const deletedTrade = await prisma.trade.findFirst({
      where: { positionId: tempPosition.id },
    });

    expect(deletedTrade).toBeNull();

    // Cleanup
    await prisma.user.delete({ where: { id: tempUser.id } });
  });

  test('should track blockchain metadata', async () => {
    const trade = await prisma.trade.create({
      data: {
        positionId: testPositionId,
        userId: testUserId,
        tradingPairId: testTradingPairId,
        tradeType: 'OPEN',
        side: 'LONG',
        price: 3000,
        quantity: 1,
        value: 3000,
        fee: 3,
        txHash: '0xvwx234',
        blockNumber: BigInt(1234567),
      },
    });

    expect(trade.txHash).toBe('0xvwx234');
    expect(trade.blockNumber).toBe(BigInt(1234567));
  });

  test('should query trades by user', async () => {
    await prisma.trade.createMany({
      data: [
        {
          positionId: testPositionId,
          userId: testUserId,
          tradingPairId: testTradingPairId,
          tradeType: 'OPEN',
          side: 'LONG',
          price: 3000,
          quantity: 1,
          value: 3000,
          fee: 3,
          txHash: '0x1',
        },
        {
          positionId: testPositionId,
          userId: testUserId,
          tradingPairId: testTradingPairId,
          tradeType: 'CLOSE',
          side: 'LONG',
          price: 3200,
          quantity: 1,
          value: 3200,
          fee: 3.2,
          pnl: 200,
          txHash: '0x2',
        },
      ],
    });

    const userTrades = await prisma.trade.findMany({
      where: { userId: testUserId },
      orderBy: { executedAt: 'desc' },
    });

    expect(userTrades).toHaveLength(2);
  });

  test('should query trades by position', async () => {
    await prisma.trade.createMany({
      data: [
        {
          positionId: testPositionId,
          userId: testUserId,
          tradingPairId: testTradingPairId,
          tradeType: 'OPEN',
          side: 'LONG',
          price: 3000,
          quantity: 1,
          value: 3000,
          fee: 3,
          txHash: '0x3',
        },
        {
          positionId: testPositionId,
          userId: testUserId,
          tradingPairId: testTradingPairId,
          tradeType: 'PARTIAL_CLOSE',
          side: 'LONG',
          price: 3100,
          quantity: 0.5,
          value: 1550,
          fee: 1.55,
          pnl: 50,
          txHash: '0x4',
        },
      ],
    });

    const positionTrades = await prisma.trade.findMany({
      where: { positionId: testPositionId },
    });

    expect(positionTrades).toHaveLength(2);
  });
});
