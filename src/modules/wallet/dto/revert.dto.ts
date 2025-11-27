import { IsNotEmpty, IsString } from 'class-validator';

export class RevertDTO {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

