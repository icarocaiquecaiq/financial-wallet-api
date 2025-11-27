import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepositDTO } from './dto/deposit.dto';
import { TransferDTO } from './dto/transfer.dto';
import { RevertDTO } from './dto/revert.dto';
import { TransactionHistoryDTO } from './dto/transaction-history.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('transactions')
  async getTransactions(
    @Request() req,
    @Query() query: TransactionHistoryDTO,
  ) {
    return this.walletService.getTransactions(req.user.userId, query);
  }
  
  @Get('balance')
  async getBalance(@Request() req) {
    return this.walletService.getBalance(req.user.userId);
  }

  @Post('deposit')
  async deposit(@Request() req, @Body() body: DepositDTO) {
    return this.walletService.deposit(req.user.userId, body);
  }

  @Post('transfer')
  async transfer(@Request() req, @Body() body: TransferDTO) {
    return this.walletService.transfer(req.user.userId, body);
  }

  @Post('revert/:id')
  async revert(
    @Request() req,
    @Param('id', ParseIntPipe) transactionId: number,
    @Body() body: RevertDTO,
  ) {
    return this.walletService.revert(req.user.userId, transactionId, body);
  }
}
