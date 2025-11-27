import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class TransferDTO {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  amountInCents: number;

  @IsString()
  @IsNotEmpty()
  receiverUsername: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

