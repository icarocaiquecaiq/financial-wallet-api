import { User } from '@prisma/client';

export type TUserWithoutPassword = Pick<
  User,
  'id' | 'username' | 'email' | 'isActive'
>;

export type TCreateUser = {
  username: string;
  email: string;
  password: string;
};