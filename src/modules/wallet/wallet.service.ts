import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DepositDTO } from './dto/deposit.dto';
import { TransferDTO } from './dto/transfer.dto';
import { RevertDTO } from './dto/revert.dto';
import { TransactionHistoryDTO } from './dto/transaction-history.dto';
import { Wallet, Transaction } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  private readonly ERROR_DEPOSIT = 'Error processing deposit';
  private readonly ERROR_TRANSFER = 'Error processing transfer';
  private readonly ERROR_REVERT = 'Error processing reversal';
  private readonly ERROR_WALLET_NOT_FOUND = 'Wallet not found';
  private readonly ERROR_RECEIVER_NOT_FOUND = 'Receiver not found';
  private readonly ERROR_DUPLICATE_TRANSACTION =
    'Duplicate transaction detected';
  private readonly ERROR_INSUFFICIENT_FUNDS = 'Insufficient funds';
  private readonly ERROR_SELF_TRANSFER = 'Cannot transfer to yourself';
  private readonly ERROR_TRANSACTION_NOT_FOUND = 'Transaction not found';
  private readonly ERROR_REVERT_EXPIRED =
    'Transaction cannot be reverted (expired)';
  private readonly ERROR_ALREADY_REVERTED = 'Transaction already reverted';
  private readonly ERROR_INVALID_REVERT_TYPE =
    'Invalid transaction type for reversal';
  private readonly ERROR_UNAUTHORIZED_REVERT =
    'Unauthorized to revert this transaction';

  private readonly REVERT_WINDOW_DAYS = 30;

  constructor(private readonly prisma: PrismaService) {}

  private async getWalletByUserId(
    userId: number,
    includeUser: boolean = false,
  ): Promise<Wallet & { user?: any }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: includeUser ? { user: true } : undefined,
    });

    if (!wallet) throw new BadRequestException(this.ERROR_WALLET_NOT_FOUND);
    return wallet;
  }

  private async verifyIdempotency(idempotencyKey: string): Promise<void> {
    const existingTx = await this.prisma.transaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTx) {
      throw new BadRequestException(this.ERROR_DUPLICATE_TRANSACTION);
    }
  }

  private async findTransactionById(transactionId: number) {
    const originalTx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        senderWallet: true,
        receiverWallet: true,
        reversalTransaction: true,
      },
    });

    if (!originalTx) {
      throw new NotFoundException(this.ERROR_TRANSACTION_NOT_FOUND);
    }
    return originalTx;
  }

  private validateReversibility(
    originalTx: Transaction & { reversalTransaction?: Transaction | null },
    requestWalletId: number,
  ): void {
    if (originalTx.reversalTransaction || originalTx.status === 'REVERSED') {
      throw new BadRequestException(this.ERROR_ALREADY_REVERTED);
    }

    if (originalTx.status !== 'COMPLETED') {
      throw new BadRequestException('Transaction is not completed');
    }

    if (originalTx.type === 'REVERSAL') {
      throw new BadRequestException(this.ERROR_INVALID_REVERT_TYPE);
    }

    if (
      originalTx.revertExpiresAt &&
      new Date() > originalTx.revertExpiresAt
    ) {
      throw new BadRequestException(this.ERROR_REVERT_EXPIRED);
    }

    if (originalTx.type === 'DEPOSIT') {
      if (originalTx.receiverWalletId !== requestWalletId) {
        throw new ForbiddenException(this.ERROR_UNAUTHORIZED_REVERT);
      }
    } else if (originalTx.type === 'TRANSFER') {
      if (originalTx.senderWalletId !== requestWalletId) {
        throw new ForbiddenException(this.ERROR_UNAUTHORIZED_REVERT);
      }
    }
  }

  private async executeDepositTransaction(
    walletId: number,
    amountInCents: number,
    idempotencyKey: string,
    revertExpiresAt: Date,
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balanceInCents: { increment: amountInCents },
          version: { increment: 1 },
        },
      });

      const transaction = await prisma.transaction.create({
        data: {
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amountInCents,
          beforeBalanceInCents: updatedWallet.balanceInCents - amountInCents,
          afterBalanceInCents: updatedWallet.balanceInCents,
          receiverWalletId: walletId,
          idempotencyKey,
          revertExpiresAt,
        },
      });

      return {
        newBalance: updatedWallet.balanceInCents,
        transactionId: transaction.id,
      };
    });
  }

  private async executeTransferTransaction(
    senderWalletId: number,
    senderVersion: number,
    receiverWalletId: number,
    amountInCents: number,
    description: string,
    idempotencyKey: string,
    revertExpiresAt: Date,
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      const updatedSender = await prisma.wallet.update({
        where: { id: senderWalletId, version: senderVersion },
        data: {
          balanceInCents: { decrement: amountInCents },
          version: { increment: 1 },
        },
      });

      await prisma.wallet.update({
        where: { id: receiverWalletId },
        data: {
          balanceInCents: { increment: amountInCents },
          version: { increment: 1 },
        },
      });

      const beforeSenderBalance = updatedSender.balanceInCents + amountInCents;

      const transaction = await prisma.transaction.create({
        data: {
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountInCents,
          beforeBalanceInCents: beforeSenderBalance,
          afterBalanceInCents: updatedSender.balanceInCents,
          senderWalletId: senderWalletId,
          receiverWalletId: receiverWalletId,
          description,
          idempotencyKey,
          revertExpiresAt,
        },
      });

      return {
        newBalance: updatedSender.balanceInCents,
        transactionId: transaction.id,
      };
    });
  }

  private async executeReversalTransaction(
    originalTx: Transaction,
    idempotencyKey: string,
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      if (originalTx.type === 'DEPOSIT') {
        if (originalTx.receiverWalletId) {
          await prisma.wallet.update({
            where: { id: originalTx.receiverWalletId },
            data: {
              balanceInCents: { decrement: originalTx.amountInCents },
              version: { increment: 1 },
            },
          });
        }
      } else if (originalTx.type === 'TRANSFER') {
        if (originalTx.senderWalletId) {
          await prisma.wallet.update({
            where: { id: originalTx.senderWalletId },
            data: {
              balanceInCents: { increment: originalTx.amountInCents },
              version: { increment: 1 },
            },
          });
        }

        if (originalTx.receiverWalletId) {
          await prisma.wallet.update({
            where: { id: originalTx.receiverWalletId },
            data: {
              balanceInCents: { decrement: originalTx.amountInCents },
              version: { increment: 1 },
            },
          });
        }
      }

      await prisma.transaction.update({
        where: { id: originalTx.id },
        data: { status: 'REVERSED' },
      });

      const reversalTx = await prisma.transaction.create({
        data: {
          type: 'REVERSAL',
          status: 'COMPLETED',
          amountInCents: originalTx.amountInCents,
          senderWalletId:
            originalTx.type === 'TRANSFER'
              ? originalTx.receiverWalletId
              : originalTx.receiverWalletId,
          receiverWalletId:
            originalTx.type === 'TRANSFER' ? originalTx.senderWalletId : null,

          originalTransactionId: originalTx.id,
          idempotencyKey,
          description: `Reversal of transaction #${originalTx.id}`,
        },
      });

      return reversalTx;
    });
  }

  async getBalance(userId: number) {
    try {
      const wallet = await this.getWalletByUserId(userId);
      return { balanceInCents: wallet.balanceInCents };
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${WalletService.name}.getBalance`,
      );
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Error fetching balance');
    }
  }

  async getTransactions(userId: number, query: TransactionHistoryDTO) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const wallet = await this.getWalletByUserId(userId);

      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: {
            OR: [
              { senderWalletId: wallet.id },
              { receiverWalletId: wallet.id },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip,
          include: {
            senderWallet: {
              include: {
                user: {
                  select: { id: true, username: true, email: true },
                },
              },
            },
            receiverWallet: {
              include: {
                user: {
                  select: { id: true, username: true, email: true },
                },
              },
            },
          },
        }),
        this.prisma.transaction.count({
          where: {
            OR: [
              { senderWalletId: wallet.id },
              { receiverWalletId: wallet.id },
            ],
          },
        }),
      ]);

      return {
        data: transactions,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${WalletService.name}.getTransactions`,
      );
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Error fetching transactions');
    }
  }

  async deposit(userId: number, dto: DepositDTO) {
    const { amountInCents, idempotencyKey } = dto;

    try {
      await this.verifyIdempotency(idempotencyKey);
      const wallet = await this.getWalletByUserId(userId);

      const revertExpiresAt = new Date();
      revertExpiresAt.setDate(
        revertExpiresAt.getDate() + this.REVERT_WINDOW_DAYS,
      );

      return await this.executeDepositTransaction(
        wallet.id,
        amountInCents,
        idempotencyKey,
        revertExpiresAt,
      );
    } catch (e) {
      this.logger.error(e.message, e.stack, `${WalletService.name}.deposit`);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException(this.ERROR_DEPOSIT);
    }
  }

  async transfer(userId: number, dto: TransferDTO) {
    const { amountInCents, receiverUsername, description = '', idempotencyKey } =
      dto;

    try {
      await this.verifyIdempotency(idempotencyKey);
      const senderWallet = await this.getWalletByUserId(userId, true);

      if (senderWallet.user.username === receiverUsername) {
        throw new BadRequestException(this.ERROR_SELF_TRANSFER);
      }

      const receiverUser = await this.prisma.user.findUnique({
        where: { username: receiverUsername },
        include: { wallet: true },
      });

      if (!receiverUser || !receiverUser.wallet) {
        throw new BadRequestException(this.ERROR_RECEIVER_NOT_FOUND);
      }

      const receiverWallet = receiverUser.wallet;

      if (senderWallet.balanceInCents < amountInCents) {
        throw new BadRequestException(this.ERROR_INSUFFICIENT_FUNDS);
      }

      const revertExpiresAt = new Date();
      revertExpiresAt.setDate(
        revertExpiresAt.getDate() + this.REVERT_WINDOW_DAYS,
      );

      return await this.executeTransferTransaction(
        senderWallet.id,
        senderWallet.version,
        receiverWallet.id,
        amountInCents,
        description,
        idempotencyKey,
        revertExpiresAt,
      );
    } catch (e) {
      this.logger.error(e.message, e.stack, `${WalletService.name}.transfer`);
      if (e.code === 'P2025') {
        throw new InternalServerErrorException(
          'Transaction failed due to concurrency. Please try again.',
        );
      }
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException(this.ERROR_TRANSFER);
    }
  }

  async revert(userId: number, transactionId: number, dto: RevertDTO) {
    const { idempotencyKey } = dto;

    try {
      await this.verifyIdempotency(idempotencyKey);
      const originalTx = await this.findTransactionById(transactionId);
      const requestWallet = await this.getWalletByUserId(userId);

      this.validateReversibility(originalTx, requestWallet.id);

      return await this.executeReversalTransaction(originalTx, idempotencyKey);
    } catch (e) {
      this.logger.error(e.message, e.stack, `${WalletService.name}.revert`);
      if (
        e instanceof BadRequestException ||
        e instanceof ForbiddenException ||
        e instanceof NotFoundException
      )
        throw e;
      throw new InternalServerErrorException(this.ERROR_REVERT);
    }
  }
}
