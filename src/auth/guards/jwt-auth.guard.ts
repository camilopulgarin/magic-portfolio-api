import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Access Token Guard
 * Protects routes that require authentication
 * Uses the 'jwt-access' strategy
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  /**
   * Handle request authentication
   * @param err - Error from passport
   * @param user - Authenticated user
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
      // Provide generic error message to avoid leaking information
      let message = 'Unauthorized';

      if (info?.name === 'TokenExpiredError') {
        message = 'Access token expired';
      } else if (info?.name === 'JsonWebTokenError') {
        message = 'Invalid access token';
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
