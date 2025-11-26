import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { RegisterResponse, TLogin } from './types/auth.types';
import { PrismaService } from '../infra/prisma/prisma.service';
import { TCreateUser, TUserWithoutPassword } from '../user/types/user.types';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  private readonly MESSAGE_ERROR_USER_NOT_FOUND = 'Username or email not found';
  private readonly MESSAGE_ERROR_INVALID_PASSWORD = 'Invalid password';
  private readonly MESSAGE_ERROR_UNKNOWN_ERROR =
    'Unknown error occurred while validating user';
  private readonly MESSAGE_ERROR_ERROR_TO_LOGIN = 'Error to login';
  private readonly MESSAGE_ERROR_USER_NOT_ACTIVE = 'User not active';

  async validateUser(params: TLogin): Promise<TUserWithoutPassword> {
    try {
      const { login, password } = params;
      // Check if login is email or username
      const user = await this.findByLogin(login);

      if (!user) throw new NotFoundException(this.MESSAGE_ERROR_USER_NOT_FOUND);
      if (!user.isActive)
        throw new UnauthorizedException(this.MESSAGE_ERROR_USER_NOT_ACTIVE);

      const isPassCompared = await bcrypt.compare(password, user.password);

      if (!isPassCompared) {
        throw new UnauthorizedException(this.MESSAGE_ERROR_INVALID_PASSWORD);
      }

      const { password: _, ...result } = user;
      return result;
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${AuthService.name}.${this.validateUser.name}`,
      );

      // We don't check for HttpException here because we want validateUser to be agnostic
      // The Strategies will handle the exceptions (Unauthorized usually)
      // But re-throwing HttpException is good practice if we had specific ones
      if (e.status) throw e;

      throw new InternalServerErrorException(this.MESSAGE_ERROR_UNKNOWN_ERROR);
    }
  }

  async login(user: TUserWithoutPassword): Promise<{ access_token: string }> {
    try {
      const { email, id } = user;

      const payload = { email, sub: id };
      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
      };
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${AuthService.name}.${this.login.name}`,
      );
      throw new InternalServerErrorException(this.MESSAGE_ERROR_ERROR_TO_LOGIN);
    }
  }

  async register(user: TCreateUser): Promise<RegisterResponse> {
    try {
      // Delegate creation to UserService (Single Responsibility Principle)
      const createdUser = await this.userService.create(user);

      // Generate token
      const { access_token } = await this.login(createdUser);

      return {
        user: createdUser,
        access_token,
      };
    } catch (e) {
      this.logger.error(
        e.message,
        e.stack,
        `${AuthService.name}.${this.register.name}`,
      );

      // Propagate exceptions from UserService (e.g. BadRequest if user exists)
      throw e;
    }
  }

  async findByLogin(login: string): Promise<User | null> {
    try {
      const isEmail = login.includes('@');
      if (isEmail) {
        return await this.prisma.user.findUnique({
          where: { email: login },
        });
      }
      return await this.prisma.user.findUnique({
        where: { username: login },
      });
    } catch (e) {
      this.logger.error(e.message, e.stack, `${AuthService.name}.findByLogin`);
      throw new InternalServerErrorException(this.MESSAGE_ERROR_ERROR_TO_LOGIN);
    }
  }
}
