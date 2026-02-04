import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('User Model', () => {
  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  test('should create user with unique Sui address', async () => {
    const user = await prisma.user.create({
      data: {
        suiAddress: '0x1234567890abcdef',
        username: 'testuser',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.suiAddress).toBe('0x1234567890abcdef');
    expect(user.username).toBe('testuser');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  test('should enforce unique Sui address constraint', async () => {
    await prisma.user.create({
      data: {
        suiAddress: '0xunique123',
        username: 'user1',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          suiAddress: '0xunique123',
          username: 'user2',
        },
      })
    ).rejects.toThrow();
  });

  test('should enforce unique email constraint', async () => {
    await prisma.user.create({
      data: {
        suiAddress: '0xuser1',
        username: 'user1',
        email: 'test@example.com',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          suiAddress: '0xuser2',
          username: 'user2',
          email: 'test@example.com',
        },
      })
    ).rejects.toThrow();
  });

  test('should support soft delete', async () => {
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xsoftdelete',
        username: 'deleteme',
      },
    });

    // Soft delete by setting deletedAt
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    // Query active users only
    const activeUsers = await prisma.user.findMany({
      where: { deletedAt: null },
    });

    expect(activeUsers.find((u) => u.id === user.id)).toBeUndefined();
  });

  test('should allow optional fields to be null', async () => {
    const user = await prisma.user.create({
      data: {
        suiAddress: '0xminimal',
        username: 'minimal',
        // email, avatarUrl, bio are optional
      },
    });

    expect(user.email).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.bio).toBeNull();
  });

  test('should validate username max length', async () => {
    const longUsername = 'a'.repeat(51); // 51 characters (max is 50)

    await expect(
      prisma.user.create({
        data: {
          suiAddress: '0xlongname',
          username: longUsername,
        },
      })
    ).rejects.toThrow();
  });
});
