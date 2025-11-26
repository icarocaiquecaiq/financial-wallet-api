import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { TUserWithoutPassword } from './types/user.types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('')
  getUsers(): Promise<TUserWithoutPassword[]> {
    return this.userService.findAll();
  }

  @Get(':username')
  async getByUsername(
    @Param('username') username: string,
  ): Promise<TUserWithoutPassword | null> {
    return this.userService.findByUsername(username);
  }

  @Delete(':id')
  async deactivateUser(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.userService.deactivateById(id);
  }
}
