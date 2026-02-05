import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create trading pairs
  const pairs = await Promise.all([
    prisma.tradingPair.upsert({
      where: { symbol: 'SUI/USDC' },
      update: {},
      create: { symbol: 'SUI/USDC', baseAsset: 'SUI', quoteAsset: 'USDC', minQuantity: 1, maxLeverage: 100 },
    }),
    prisma.tradingPair.upsert({
      where: { symbol: 'BTC/USDC' },
      update: {},
      create: { symbol: 'BTC/USDC', baseAsset: 'BTC', quoteAsset: 'USDC', minQuantity: 0.001, maxLeverage: 50 },
    }),
    prisma.tradingPair.upsert({
      where: { symbol: 'ETH/USDC' },
      update: {},
      create: { symbol: 'ETH/USDC', baseAsset: 'ETH', quoteAsset: 'USDC', minQuantity: 0.01, maxLeverage: 50 },
    }),
  ]);

  // Create demo traders
  const traders = [
    { suiAddress: '0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111', username: 'CryptoWhale', bio: 'Top SUI trader' },
    { suiAddress: '0xbbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222', username: 'DeFiKing', bio: 'Margin specialist' },
    { suiAddress: '0xcccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333', username: 'SuiSensei', bio: 'Copy trade leader' },
    { suiAddress: '0xdddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444', username: 'AlphaHunter', bio: 'Risk-managed leverage' },
    { suiAddress: '0xeeee5555eeee5555eeee5555eeee5555eeee5555eeee5555eeee5555eeee5555', username: 'LeverageMax', bio: 'High leverage plays' },
  ];

  const profiles = [
    { totalTrades: 342, winRate: 0.72, totalPnL: 48250.50, avgTradeSize: 5000, maxDrawdown: -8200, sharpeRatio: 2.1, followerCount: 28 },
    { totalTrades: 215, winRate: 0.68, totalPnL: 31890.75, avgTradeSize: 8000, maxDrawdown: -12500, sharpeRatio: 1.8, followerCount: 15 },
    { totalTrades: 189, winRate: 0.75, totalPnL: 22100.30, avgTradeSize: 3000, maxDrawdown: -4500, sharpeRatio: 2.4, followerCount: 42 },
    { totalTrades: 410, winRate: 0.61, totalPnL: 15670.00, avgTradeSize: 2500, maxDrawdown: -6800, sharpeRatio: 1.5, followerCount: 8 },
    { totalTrades: 98, winRate: 0.55, totalPnL: -3200.50, avgTradeSize: 10000, maxDrawdown: -22000, sharpeRatio: 0.7, followerCount: 2 },
  ];

  for (let i = 0; i < traders.length; i++) {
    const user = await prisma.user.upsert({
      where: { suiAddress: traders[i].suiAddress },
      update: { username: traders[i].username },
      create: traders[i],
    });

    await prisma.traderProfile.upsert({
      where: { userId: user.id },
      update: profiles[i],
      create: { userId: user.id, ...profiles[i] },
    });

    // Create some positions for each trader
    const pair = pairs[i % pairs.length];
    const isLong = i % 2 === 0;

    await prisma.position.create({
      data: {
        userId: user.id,
        tradingPairId: pair.id,
        positionType: isLong ? 'LONG' : 'SHORT',
        entryPrice: pair.symbol === 'BTC/USDC' ? 97800 : pair.symbol === 'ETH/USDC' ? 3350 : 3.20,
        currentPrice: pair.symbol === 'BTC/USDC' ? 98500 : pair.symbol === 'ETH/USDC' ? 3420 : 3.45,
        quantity: pair.symbol === 'BTC/USDC' ? 0.5 : pair.symbol === 'ETH/USDC' ? 5 : 1000,
        leverage: 10,
        margin: 1000,
        unrealizedPnL: isLong ? 350 : -120,
        status: 'OPEN',
        onChainPositionId: `0x${(i + 1).toString().padStart(64, '0')}`,
      },
    });

    // Create a closed position with trade record
    const closedPosition = await prisma.position.create({
      data: {
        userId: user.id,
        tradingPairId: pair.id,
        positionType: isLong ? 'SHORT' : 'LONG',
        entryPrice: pair.symbol === 'BTC/USDC' ? 96000 : pair.symbol === 'ETH/USDC' ? 3200 : 2.90,
        currentPrice: pair.symbol === 'BTC/USDC' ? 97000 : pair.symbol === 'ETH/USDC' ? 3300 : 3.10,
        quantity: pair.symbol === 'BTC/USDC' ? 0.3 : pair.symbol === 'ETH/USDC' ? 3 : 500,
        leverage: 5,
        margin: 500,
        realizedPnL: isLong ? -150 : 420,
        status: 'CLOSED',
        closedAt: new Date(),
        onChainPositionId: `0x${(i + 10).toString().padStart(64, '0')}`,
      },
    });

    await prisma.trade.create({
      data: {
        positionId: closedPosition.id,
        userId: user.id,
        tradingPairId: pair.id,
        tradeType: 'CLOSE',
        side: isLong ? 'SHORT' : 'LONG',
        price: pair.symbol === 'BTC/USDC' ? 97000 : pair.symbol === 'ETH/USDC' ? 3300 : 3.10,
        quantity: pair.symbol === 'BTC/USDC' ? 0.3 : pair.symbol === 'ETH/USDC' ? 3 : 500,
        value: 1500,
        fee: 1.5,
        pnl: isLong ? -150 : 420,
        txHash: `0xtx${i.toString().padStart(62, '0')}`,
      },
    });
  }

  // Create a copy relation
  const [whale, defiKing] = await Promise.all([
    prisma.user.findUnique({ where: { suiAddress: traders[0].suiAddress } }),
    prisma.user.findUnique({ where: { suiAddress: traders[1].suiAddress } }),
  ]);

  if (whale && defiKing) {
    await prisma.copyRelation.upsert({
      where: { traderId_followerId: { traderId: whale.id, followerId: defiKing.id } },
      update: {},
      create: {
        traderId: whale.id,
        followerId: defiKing.id,
        copyRatio: 0.5,
        maxPositionSize: 2000,
        isActive: true,
      },
    });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
