import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class DepositDTO {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  amountInCents: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

