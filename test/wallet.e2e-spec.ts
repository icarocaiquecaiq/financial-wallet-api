import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/infra/prisma/prisma.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('WalletController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Mock user for auth
  const mockUser = {
    userId: 1,
    username: 'testuser',
    email: 'test@example.com',
  };

  // Mock Prisma
  const mockPrismaService = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('/wallet/deposit (POST)', () => {
    it('should deposit successfully', async () => {
      const depositDto = {
        amountInCents: 1000,
        idempotencyKey: 'unique-key-1',
      };

      // Mocks for deposit flow
      mockPrismaService.transaction.findUnique.mockResolvedValue(null); // Idempotency check
      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        balanceInCents: 0,
        version: 1,
      });
      mockPrismaService.wallet.update.mockResolvedValue({
        id: 1,
        balanceInCents: 1000,
      });
      mockPrismaService.transaction.create.mockResolvedValue({ id: 100 });

      return request(app.getHttpServer())
        .post('/wallet/deposit')
        .send(depositDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.newBalance).toBe(1000);
          expect(res.body.transactionId).toBe(100);
        });
    });

    it('should fail with duplicate idempotency key', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue({ id: 1 });

      return request(app.getHttpServer())
        .post('/wallet/deposit')
        .send({ amountInCents: 1000, idempotencyKey: 'dup-key' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Duplicate transaction detected');
        });
    });
  });

  describe('/wallet/transfer (POST)', () => {
    it('should transfer successfully', async () => {
      const transferDto = {
        amountInCents: 500,
        receiverUsername: 'receiver',
        idempotencyKey: 'transfer-key-1',
      };

      // Mocks
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      
      // Sender Wallet
      mockPrismaService.wallet.findUnique.mockImplementation((args) => {
        if (args.where.userId === 1) {
          return Promise.resolve({
            id: 1,
            userId: 1,
            balanceInCents: 1000,
            version: 1,
            user: { username: 'sender' },
          });
        }
        return null;
      });

      // Receiver User & Wallet
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 2,
        username: 'receiver',
        wallet: { id: 2, userId: 2, balanceInCents: 0 },
      });

      mockPrismaService.wallet.update
        .mockResolvedValueOnce({ balanceInCents: 500 }) // Sender update
        .mockResolvedValueOnce({ balanceInCents: 500 }); // Receiver update

      mockPrismaService.transaction.create.mockResolvedValue({ id: 101 });

      return request(app.getHttpServer())
        .post('/wallet/transfer')
        .send(transferDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.newBalance).toBe(500);
        });
    });

    it('should fail insufficient funds', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 1,
        user: { username: 'sender' },
        balanceInCents: 0, // Zero balance
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 2,
        wallet: { id: 2 },
      });

      return request(app.getHttpServer())
        .post('/wallet/transfer')
        .send({
          amountInCents: 500,
          receiverUsername: 'receiver',
          idempotencyKey: 'key',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Insufficient funds');
        });
    });
  });

  describe('/wallet/revert/:id (POST)', () => {
    it('should revert deposit successfully', async () => {
      const transactionId = 100;
      const revertDto = { idempotencyKey: 'revert-key-1' };

      // Mocks
      mockPrismaService.transaction.findUnique.mockImplementation((args) => {
        if (args.where.id === transactionId) {
          return Promise.resolve({
            id: transactionId,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            amountInCents: 1000,
            receiverWalletId: 1, // User's wallet
            revertExpiresAt: new Date(Date.now() + 10000), // Future date
          });
        }
        if (args.where.idempotencyKey === 'revert-key-1') {
          return Promise.resolve(null); // Idempotency check
        }
        return null;
      });

      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        balanceInCents: 1000,
      });

      mockPrismaService.wallet.update.mockResolvedValue({ balanceInCents: 0 });
      mockPrismaService.transaction.create.mockResolvedValue({ id: 200 });

      return request(app.getHttpServer())
        .post(`/wallet/revert/${transactionId}`)
        .send(revertDto)
        .expect(201);
    });

    it('should fail to revert if already reverted', async () => {
        const transactionId = 100;
        
        mockPrismaService.transaction.findUnique.mockResolvedValueOnce(null); // Idempotency Check - Not Found (OK)
        
        mockPrismaService.transaction.findUnique.mockResolvedValueOnce({ // Find Original Tx
            id: transactionId,
            type: 'DEPOSIT',
            status: 'REVERSED', // Already reversed
            amountInCents: 1000,
            receiverWalletId: 1,
        });

        return request(app.getHttpServer())
            .post(`/wallet/revert/${transactionId}`)
            .send({ idempotencyKey: 'key' })
            .expect(400)
            .expect((res) => {
                expect(res.body.message).toBe('Transaction already reverted');
            });
    });
  });
});
