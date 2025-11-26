import { Controller, Request, Post, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDTO } from './dto/input/login.dto';
import { CreateUserDTO } from '../user/dto/input/create-user.dto';
import { RegisterResponse } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDTO, @Request() req) {
    // The local strategy will handle the validation using the Body fields 'login' and 'password'
    // req.user is populated by the LocalStrategy return value
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDTO,
  ): Promise<RegisterResponse> {
    return this.authService.register(createUserDto);
  }
}
