import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import {
  IOAuthProfile,
  IOAuthStrategy,
} from '../../common/interfaces/oauth.interfaces';

/**
 * Google OAuth Strategy
 * Implements both PassportStrategy (for redirect flow) and IOAuthStrategy
 * (for registration in OAuthStrategyRegistry)
 */
@Injectable()
export class GoogleStrategy
  extends PassportStrategy(Strategy, 'google')
  implements IOAuthStrategy
{
  readonly provider = 'google' as const;

  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  /**
   * Called by Passport after successful Google redirect.
   * Normalizes Google profile to IOAuthProfile and attaches it to req.user.
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const oauthProfile: IOAuthProfile = {
      provider: 'google',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      fullName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    done(null, oauthProfile);
  }

  /**
   * IOAuthStrategy implementation — used when the profile is already
   * resolved (e.g. from req.user after Passport validation).
   * Not called during the redirect flow; validate() handles that case.
   */
  async validateAndGetProfile(token: string): Promise<IOAuthProfile> {
    // In the redirect flow this method is never called directly.
    // It exists to satisfy the IOAuthStrategy contract so this strategy
    // can be registered in OAuthStrategyRegistry.
    throw new Error(
      'Use the redirect flow (GET /auth/google) instead of direct token exchange.',
    );
  }
}
