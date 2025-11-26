import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  private readonly logger = new Logger(LocalAuthGuard.name);

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.error(
        `Local Authentication failed: ${info?.message || err?.message || 'Invalid credentials'}`,
      );
      throw (
        err || new UnauthorizedException(info?.message || 'Invalid credentials')
      );
    }
    return user;
  }
}
