import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from '../../common/interfaces/auth.interfaces';

/**
 * JWT Access Token Strategy
 * Validates access tokens from Authorization header
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Validate JWT payload and attach to request
   * @param payload - Decoded JWT payload
   * @returns Payload to be attached to request.user
   */
  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
