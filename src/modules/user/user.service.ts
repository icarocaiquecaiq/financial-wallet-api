import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  TCreateUser,
  TUserWithoutPassword,
  userSelect,
} from './types/user.types';
import { PrismaService } from '../infra/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  // Error Messages
  private readonly ERROR_CREATE_USER = 'Error creating user in database';
  private readonly ERROR_USER_ALREADY_EXISTS =
    'User with this email or username already exists';
  private readonly ERROR_FIND_USER = 'Error finding user';
  private readonly ERROR_UPDATE_USER = 'Error updating user';

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TUserWithoutPassword[]> {
    try {
      return await this.prisma.user.findMany({
        select: userSelect,
      });
    } catch (e) {
      this.logger.error(e.message, e.stack, `${UserService.name}.findAll`);
      throw new InternalServerErrorException(this.ERROR_FIND_USER);
    }
  }

  async findByUsername(username: string): Promise<TUserWithoutPassword | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { username },
        select: userSelect,
      });
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${UserService.name}.findByUsername`,
      );
      throw new InternalServerErrorException(this.ERROR_FIND_USER);
    }
  }

  async findByEmail(email: string): Promise<TUserWithoutPassword | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
        select: userSelect,
      });
    } catch (e) {
      this.logger.error(e.message, e.stack, `${UserService.name}.findByEmail`);
      throw new InternalServerErrorException(this.ERROR_FIND_USER);
    }
  }

  async deactivateById(id: number): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (e) {
      this.logger.error(e.message, e.stack, `${UserService.name}.deleteById`);
      throw new InternalServerErrorException(this.ERROR_UPDATE_USER);
    }
  }

  async create(params: TCreateUser): Promise<TUserWithoutPassword> {
    try {
      const { username, email, password } = params;

      const existingUser = await this.prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });

      if (existingUser) {
        throw new BadRequestException(this.ERROR_USER_ALREADY_EXISTS);
      }

      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          wallet: {
            create: {
              balanceInCents: 0,
              version: 1,
            },
          },
        },
        select: userSelect,
      });

      return user;
    } catch (e) {
      this.logger.error(e.message, e.stack, `${UserService.name}.create`);

      if (e instanceof HttpException) {
        throw e;
      }
      throw new InternalServerErrorException(this.ERROR_CREATE_USER);
    }
  }
}
