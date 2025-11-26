import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private authService: AuthService) {
    super({
      usernameField: 'login',
      passwordField: 'password',
    });
  }

  async validate(login: string, password: string): Promise<any> {
    this.logger.debug(`Attempting local login for user: ${login}`);
    const user = await this.authService.validateUser({ login, password });
    if (!user) {
      this.logger.warn(`Local login failed for user: ${login}`);
      throw new UnauthorizedException();
    }
    return user;
  }
}
