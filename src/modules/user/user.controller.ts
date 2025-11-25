import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDTO } from './dto/input/create-user.dto';
import { TCreateUser } from './types/user.types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('')
  getUsers(): Promise<string> {
    return this.userService.findAll();
  }

  @Post('')
  async createUser(@Body() body: CreateUserDTO): Promise<TCreateUser> {
    return this.userService.create(body);
  }
}
