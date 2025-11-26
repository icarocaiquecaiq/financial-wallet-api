import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateUserDTO {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username must contain only letters, numbers, and underscores',
  })
  username: string;

  @IsEmail()
  email: string;

  @MaxLength(50)
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
