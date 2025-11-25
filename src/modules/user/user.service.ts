import { Injectable } from '@nestjs/common';
import { TCreateUser } from './types/user.types';

@Injectable()
export class UserService {
  async findAll(): Promise<string> {
    return 'List of users';
  }

  async create(params: TCreateUser): Promise<TCreateUser> {
    return params;
  }
}
