import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Notification Model', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xnotif_test_user',
        username: 'notiftester',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany();
  });

  test('should create notification with required fields', async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'POSITION_OPENED',
        title: 'Position Opened',
        message: 'Your LONG position on BTC/USDC has been opened',
      },
    });

    expect(notification.id).toBeDefined();
    expect(notification.userId).toBe(testUserId);
    expect(notification.type).toBe('POSITION_OPENED');
    expect(notification.title).toBe('Position Opened');
    expect(notification.message).toBe('Your LONG position on BTC/USDC has been opened');
    expect(notification.isRead).toBe(false);
    expect(notification.createdAt).toBeInstanceOf(Date);
  });

  test('should default isRead to false', async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'POSITION_CLOSED',
        title: 'Position Closed',
        message: 'Your position has been closed with profit',
      },
    });

    expect(notification.isRead).toBe(false);
    expect(notification.readAt).toBeNull();
  });

  test('should support different notification types', async () => {
    const types = [
      'POSITION_OPENED',
      'POSITION_CLOSED',
      'COPY_EXECUTED',
      'STOP_LOSS_HIT',
      'LIQUIDATION',
    ];

    for (const type of types) {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type,
          title: `${type} Notification`,
          message: `Test message for ${type}`,
        },
      });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: testUserId },
    });

    expect(notifications).toHaveLength(5);
    expect(notifications.map((n) => n.type).sort()).toEqual(types.sort());
  });

  test('should store additional data as JSON', async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'POSITION_OPENED',
        title: 'Position Opened',
        message: 'Your position has been opened',
        data: {
          positionId: '123',
          tradingPair: 'BTC/USDC',
          entryPrice: 50000,
          quantity: 0.1,
        },
      },
    });

    expect(notification.data).toBeDefined();
    expect(notification.data).toEqual({
      positionId: '123',
      tradingPair: 'BTC/USDC',
      entryPrice: 50000,
      quantity: 0.1,
    });
  });

  test('should mark notification as read', async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'COPY_EXECUTED',
        title: 'Copy Trade Executed',
        message: 'A copy trade has been executed',
      },
    });

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    expect(updated.isRead).toBe(true);
    expect(updated.readAt).toBeInstanceOf(Date);
  });

  test('should query unread notifications', async () => {
    await prisma.notification.createMany({
      data: [
        {
          userId: testUserId,
          type: 'POSITION_OPENED',
          title: 'New Position',
          message: 'Position opened',
          isRead: false,
        },
        {
          userId: testUserId,
          type: 'POSITION_CLOSED',
          title: 'Closed Position',
          message: 'Position closed',
          isRead: true,
          readAt: new Date(),
        },
        {
          userId: testUserId,
          type: 'COPY_EXECUTED',
          title: 'Copy Trade',
          message: 'Copy executed',
          isRead: false,
        },
      ],
    });

    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId: testUserId,
        isRead: false,
      },
    });

    expect(unreadNotifications).toHaveLength(2);
    expect(unreadNotifications.every((n) => !n.isRead)).toBe(true);
  });

  test('should query notifications ordered by creation date', async () => {
    const notification1 = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'POSITION_OPENED',
        title: 'First',
        message: 'First notification',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const notification2 = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'POSITION_CLOSED',
        title: 'Second',
        message: 'Second notification',
      },
    });

    const notifications = await prisma.notification.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: 'desc' },
    });

    expect(notifications[0].id).toBe(notification2.id);
    expect(notifications[1].id).toBe(notification1.id);
  });

  test('should cascade delete when user is deleted', async () => {
    const tempUser = await prisma.user.create({
      data: {
        suiAddress: '0xtemp_notif_user',
        username: 'tempnotifuser',
      },
    });

    await prisma.notification.create({
      data: {
        userId: tempUser.id,
        type: 'POSITION_OPENED',
        title: 'Test',
        message: 'Test notification',
      },
    });

    await prisma.user.delete({
      where: { id: tempUser.id },
    });

    const deletedNotification = await prisma.notification.findFirst({
      where: { userId: tempUser.id },
    });

    expect(deletedNotification).toBeNull();
  });

  test('should include user data when querying with relations', async () => {
    await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'STOP_LOSS_HIT',
        title: 'Stop Loss Triggered',
        message: 'Your stop loss has been triggered',
      },
    });

    const notification = await prisma.notification.findFirst({
      where: { userId: testUserId },
      include: { user: true },
    });

    expect(notification).toBeDefined();
    expect(notification?.user.id).toBe(testUserId);
    expect(notification?.user.suiAddress).toBe('0xnotif_test_user');
  });

  test('should support liquidation notifications', async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'LIQUIDATION',
        title: 'Position Liquidated',
        message: 'Your position has been liquidated',
        data: {
          positionId: 'pos_123',
          liquidationPrice: 45000,
          loss: -500,
        },
      },
    });

    expect(notification.type).toBe('LIQUIDATION');
    expect(notification.data).toEqual({
      positionId: 'pos_123',
      liquidationPrice: 45000,
      loss: -500,
    });
  });
});
