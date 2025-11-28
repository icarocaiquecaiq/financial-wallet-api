import { TUserWithoutPassword } from '../../user/types/user.types';

export type TLogin = {
  login: string;
  password: string;
};

export type TAuthResponse = {
  user: TUserWithoutPassword;
  access_token: string;
};
