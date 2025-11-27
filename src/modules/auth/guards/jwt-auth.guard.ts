import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.error(
        `JWT Authentication failed: ${info?.message || err?.message || 'User not found'}`,
      );
      throw (
        err || new UnauthorizedException(info?.message || 'User not authenticated')
      );
    }
    return user;
  }
}
