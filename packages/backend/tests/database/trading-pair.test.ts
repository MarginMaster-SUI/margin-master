import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('TradingPair Model', () => {
  afterAll(async () => {
    await prisma.tradingPair.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.tradingPair.deleteMany();
  });

  test('should create trading pair with valid symbol', async () => {
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'BTC/USDC',
        baseAsset: 'BTC',
        quoteAsset: 'USDC',
        minQuantity: 0.001,
        maxLeverage: 10,
      },
    });

    expect(pair.id).toBeDefined();
    expect(pair.symbol).toBe('BTC/USDC');
    expect(pair.baseAsset).toBe('BTC');
    expect(pair.quoteAsset).toBe('USDC');
    expect(pair.minQuantity).toBe(0.001);
    expect(pair.maxLeverage).toBe(10);
    expect(pair.isActive).toBe(true);
    expect(pair.createdAt).toBeInstanceOf(Date);
  });

  test('should enforce unique symbol constraint', async () => {
    await prisma.tradingPair.create({
      data: {
        symbol: 'ETH/USDC',
        baseAsset: 'ETH',
        quoteAsset: 'USDC',
        minQuantity: 0.01,
        maxLeverage: 10,
      },
    });

    await expect(
      prisma.tradingPair.create({
        data: {
          symbol: 'ETH/USDC',
          baseAsset: 'ETH',
          quoteAsset: 'USDC',
          minQuantity: 0.01,
          maxLeverage: 10,
        },
      })
    ).rejects.toThrow();
  });

  test('should set default isActive to true', async () => {
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'SOL/USDC',
        baseAsset: 'SOL',
        quoteAsset: 'USDC',
        minQuantity: 0.1,
        maxLeverage: 10,
      },
    });

    expect(pair.isActive).toBe(true);
  });

  test('should allow deactivating trading pair', async () => {
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'DOGE/USDC',
        baseAsset: 'DOGE',
        quoteAsset: 'USDC',
        minQuantity: 1,
        maxLeverage: 5,
        isActive: false,
      },
    });

    expect(pair.isActive).toBe(false);
  });

  test('should support various leverage settings', async () => {
    const lowLeveragePair = await prisma.tradingPair.create({
      data: {
        symbol: 'BTC/USD',
        baseAsset: 'BTC',
        quoteAsset: 'USD',
        minQuantity: 0.001,
        maxLeverage: 3,
      },
    });

    const highLeveragePair = await prisma.tradingPair.create({
      data: {
        symbol: 'ETH/USD',
        baseAsset: 'ETH',
        quoteAsset: 'USD',
        minQuantity: 0.01,
        maxLeverage: 20,
      },
    });

    expect(lowLeveragePair.maxLeverage).toBe(3);
    expect(highLeveragePair.maxLeverage).toBe(20);
  });

  test('should query active trading pairs only', async () => {
    await prisma.tradingPair.createMany({
      data: [
        {
          symbol: 'BTC/USDC',
          baseAsset: 'BTC',
          quoteAsset: 'USDC',
          minQuantity: 0.001,
          maxLeverage: 10,
          isActive: true,
        },
        {
          symbol: 'ETH/USDC',
          baseAsset: 'ETH',
          quoteAsset: 'USDC',
          minQuantity: 0.01,
          maxLeverage: 10,
          isActive: true,
        },
        {
          symbol: 'OLD/USDC',
          baseAsset: 'OLD',
          quoteAsset: 'USDC',
          minQuantity: 1,
          maxLeverage: 5,
          isActive: false,
        },
      ],
    });

    const activePairs = await prisma.tradingPair.findMany({
      where: { isActive: true },
    });

    expect(activePairs).toHaveLength(2);
    expect(activePairs.every((p) => p.isActive)).toBe(true);
  });

  test('should update trading pair settings', async () => {
    const pair = await prisma.tradingPair.create({
      data: {
        symbol: 'ADA/USDC',
        baseAsset: 'ADA',
        quoteAsset: 'USDC',
        minQuantity: 1,
        maxLeverage: 5,
      },
    });

    const updated = await prisma.tradingPair.update({
      where: { id: pair.id },
      data: {
        maxLeverage: 10,
        minQuantity: 0.5,
      },
    });

    expect(updated.maxLeverage).toBe(10);
    expect(updated.minQuantity).toBe(0.5);
  });
});
