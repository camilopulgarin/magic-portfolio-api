import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { IJwtRefreshPayload } from '../../common/interfaces/auth.interfaces';
import type { ISessionsRepository } from '../../common/interfaces/user.interfaces';
import { SESSIONS_REPOSITORY } from '../../common/interfaces/user.interfaces';

/**
 * JWT Refresh Token Strategy
 * Validates refresh tokens and checks session validity
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: ISessionsRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1st: body field (existing behavior — Swagger, API clients)
        ExtractJwt.fromBodyField('refreshToken'),
        // 2nd: httpOnly cookie (browser / Next.js clients)
        (req: Request) =>
          (req?.cookies?.refresh_token as string | null) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * Validate refresh token and session
   * @param req - Express request with refresh token
   * @param payload - Decoded JWT payload
   * @returns Payload with session info if valid
   */
  async validate(
    req: Request,
    payload: IJwtRefreshPayload,
  ): Promise<IJwtRefreshPayload & { refreshToken: string }> {
    // Accept token from body (existing clients) OR cookie (browser clients)
    const refreshToken =
      (req.body?.refreshToken as string | undefined) ??
      (req.cookies?.refresh_token as string | undefined);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    // Verify session exists and is not expired
    const session =
      await this.sessionsRepository.findByRefreshToken(refreshToken);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.sessionsRepository.delete(session.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Verify session belongs to the user in the token
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Token mismatch');
    }

    return {
      sub: payload.sub,
      sessionId: payload.sessionId,
      refreshToken,
    };
  }
}
