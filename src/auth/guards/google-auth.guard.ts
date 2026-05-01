import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the Google OAuth redirect flow.
 * Applied to GET /auth/google (initiates redirect) and
 * GET /auth/google/callback (handles the authorization code).
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
