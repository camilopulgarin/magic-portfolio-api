import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IOAuthProfile,
  IOAuthStrategy,
} from '../../common/interfaces/oauth.interfaces';
import { GoogleMockTokenPayload } from '../dto/google-mock.dto';

/**
 * Google OAuth Mock Strategy
 * Simulates Google OAuth for development and testing
 *
 * @todo Replace with passport-google-oauth20 in production:
 *
 * 1. Install passport-google-oauth20:
 *    npm install passport-google-oauth20 @types/passport-google-oauth20
 *
 * 2. Create GoogleStrategy:
 *    @Injectable()
 *    export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
 *      constructor(configService: ConfigService) {
 *        super({
 *          clientID: configService.get('GOOGLE_CLIENT_ID'),
 *          clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
 *          callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
 *          scope: ['email', 'profile'],
 *        });
 *      }
 *
 *      async validate(accessToken, refreshToken, profile, done) {
 *        const oauthProfile: IOAuthProfile = {
 *          provider: 'google',
 *          providerUserId: profile.id,
 *          email: profile.emails[0].value,
 *          fullName: profile.displayName,
 *          avatarUrl: profile.photos?.[0]?.value,
 *          accessToken,
 *          refreshToken,
 *        };
 *        done(null, oauthProfile);
 *      }
 *    }
 *
 * 3. Add GoogleAuthGuard and callback endpoint in controller
 *
 * 4. Update auth.module.ts to include GoogleStrategy
 */
@Injectable()
export class GoogleMockStrategy implements IOAuthStrategy {
  readonly provider = 'google' as const;

  /**
   * Validate mock Google ID token and extract profile
   * @param token - JSON string representing mock Google ID token
   * @returns Normalized OAuth profile
   * @throws BadRequestException if token is invalid JSON
   */
  async validateAndGetProfile(token: string): Promise<IOAuthProfile> {
    try {
      const parsed: GoogleMockTokenPayload = JSON.parse(token);

      // Validate required fields
      if (!parsed.sub || !parsed.email || !parsed.name) {
        throw new BadRequestException(
          'Invalid mock token: missing required fields (sub, email, name)',
        );
      }

      return {
        provider: this.provider,
        providerUserId: parsed.sub,
        email: parsed.email,
        fullName: parsed.name,
        avatarUrl: parsed.picture,
        // No access/refresh tokens in mock
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid mock token: must be valid JSON');
    }
  }
}
