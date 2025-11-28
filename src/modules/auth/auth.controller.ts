import { Controller, Request, Post, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDTO } from './dto/input/login.dto';
import { CreateUserDTO } from '../user/dto/input/create-user.dto';
import { TAuthResponse } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDTO, @Request() req): Promise<TAuthResponse> {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDTO,
  ): Promise<TAuthResponse> {
    return this.authService.register(createUserDto);
  }
}
