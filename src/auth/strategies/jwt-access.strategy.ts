import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from '../../common/interfaces/auth.interfaces';

/**
 * JWT Access Token Strategy
 * Reads token from Authorization header (Bearer) OR cookie 'access_token'.
 * Header takes priority — existing clients are unaffected.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1st: standard Authorization: Bearer header (Swagger, mobile, etc.)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2nd: httpOnly cookie (Next.js / browser clients)
        (req: Request) => (req?.cookies?.access_token as string | null) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
