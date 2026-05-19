import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RATE_LIMIT } from '../common/constants';
import {
  IJwtPayload,
  IJwtRefreshPayload,
  ISessionMetadata,
} from '../common/interfaces/auth.interfaces';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  TokensResponseDto,
  UserResponseDto,
} from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

/**
 * Request with authenticated JWT user
 */
interface AuthenticatedRequest extends Request {
  user: IJwtPayload;
}

/**
 * Request with refresh token payload
 */
interface RefreshRequest extends Request {
  user: IJwtRefreshPayload & { refreshToken: string };
}

/**
 * Request populated by Passport Google strategy
 */
interface GoogleOAuthRequest extends Request {
  user: import('../common/interfaces/oauth.interfaces').IOAuthProfile;
}

/** Shared httpOnly cookie options */
const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
} as const;

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 15 * 60 * 1000, // 15 min
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Auth controller - handles authentication endpoints
 * Applies rate limiting to prevent brute force attacks
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'Browser/client identifier (sent automatically)',
  })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email, password, full name, and username. Returns JWT tokens and user profile.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or validation error',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already registered',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 5 requests per 60 seconds)',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResponseDto> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.register(dto, metadata);

    res.cookie(
      'access_token',
      result.tokens.accessToken,
      ACCESS_COOKIE_OPTIONS,
    );
    res.cookie(
      'refresh_token',
      result.tokens.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user as UserResponseDto,
    };
  }

  /**
   * Login with email/password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'Browser/client identifier (sent automatically)',
  })
  @ApiOperation({
    summary: 'Login with credentials',
    description:
      'Authenticates a user with email and password. Returns JWT tokens and user profile. A session is created for token refresh.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid email or password',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 5 requests per 60 seconds)',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResponseDto> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.login(dto, metadata);

    res.cookie(
      'access_token',
      result.tokens.accessToken,
      ACCESS_COOKIE_OPTIONS,
    );
    res.cookie(
      'refresh_token',
      result.tokens.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user as UserResponseDto,
    };
  }

  /**
   * Refresh access token
   * Rotates refresh token for security
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token for a new token pair. The old refresh token is rotated for security (one-time use).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: TokensResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async refresh(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshTokenDto,
  ): Promise<TokensResponseDto> {
    const tokens = await this.authService.refreshTokens(
      req.user.sub,
      req.user.sessionId,
      req.user.refreshToken,
    );

    res.cookie('access_token', tokens.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout user
   * Invalidates the session
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates the session associated with the provided refresh token. Requires a valid access token.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Logout successful, session invalidated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing access token',
  })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // Accept token from body (API clients) or cookie (browser clients)
    const token =
      dto.refreshToken ??
      (res.req as { cookies?: { refresh_token?: string } }).cookies
        ?.refresh_token;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  /**
   * Initiate Google OAuth redirect flow
   * Redirects the browser to Google's consent screen
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Start Google OAuth login',
    description:
      "Redirects the user to Google's consent screen. Not callable directly from Swagger — open in a browser tab instead.",
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Google OAuth consent screen',
  })
  googleLogin(): void {
    // Passport handles the redirect — this body is never executed
  }

  /**
   * Google OAuth callback
   * Google redirects here after the user grants consent.
   * Creates a session and redirects the frontend with JWT tokens.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @Redirect()
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handled automatically by Google after consent. Creates a session and redirects to the frontend with accessToken and refreshToken as query params.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to frontend /auth/callback with tokens',
  })
  async googleCallback(
    @Req() req: GoogleOAuthRequest,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<{ url: string }> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.authenticateOAuthProfile(
      req.user,
      metadata,
    );

    // Set httpOnly cookies — frontend receives tokens without touching query params
    res.cookie(
      'access_token',
      result.tokens.accessToken,
      ACCESS_COOKIE_OPTIONS,
    );
    res.cookie(
      'refresh_token',
      result.tokens.refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return { url: `${frontendUrl}/auth/callback` };
  }

  /**
   * Change the authenticated user's password
   */
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change user password',
    description:
      'Changes the authenticated user password. Requires the current password for verification. Not available for OAuth-only accounts.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'New password is the same as current, or account uses OAuth authentication',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description:
      'Invalid or missing access token, or incorrect current password',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 5 requests per 60 seconds)',
  })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user profile data. Requires a valid access token in the Authorization header.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing access token',
  })
  async getMe(@Req() req: AuthenticatedRequest): Promise<UserResponseDto> {
    const user = await this.authService.getMe(req.user.sub);
    return user as UserResponseDto;
  }

  /**
   * Request a password reset email
   * Always returns 204 to prevent email enumeration
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiOperation({
    summary: 'Request a password reset email',
    description:
      'Sends a one-time reset link to the provided email address if an account exists. Always responds with 204 to prevent email enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Reset email sent if account exists',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 5 requests per 60 seconds)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.email);
  }

  /**
   * Reset password using one-time token from email
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  @ApiOperation({
    summary: 'Reset password with one-time token',
    description:
      'Validates the reset token received by email and updates the account password. All existing sessions are invalidated on success.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Password reset successfully, all sessions invalidated',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid, expired, or already-used reset token',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 5 requests per 60 seconds)',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
