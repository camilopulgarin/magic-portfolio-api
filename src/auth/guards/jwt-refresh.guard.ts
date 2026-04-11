import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Token Guard
 * Protects the refresh token endpoint
 * Uses the 'jwt-refresh' strategy
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  /**
   * Handle request authentication
   * @param err - Error from passport
   * @param user - Authenticated user with refresh token info
   * @param info - Additional info from passport
   * @returns User if authenticated
   * @throws UnauthorizedException if not authenticated
   */
  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    info: { name?: string; message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      let message = 'Unauthorized';

      if (info?.name === 'TokenExpiredError') {
        message = 'Refresh token expired';
      } else if (info?.name === 'JsonWebTokenError') {
        message = 'Invalid refresh token';
      }

      throw new UnauthorizedException(message);
    }

    return user;
  }

  /**
   * Determine if the guard should be activated
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
