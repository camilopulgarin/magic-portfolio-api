import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { GoogleMockDto } from './dto/google-mock.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
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
 * Auth controller - handles authentication endpoints
 * Applies rate limiting to prevent brute force attacks
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * @param dto - Registration data
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns Auth response with user and tokens
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResponseDto> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.register(dto, metadata);

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user as UserResponseDto,
    };
  }

  /**
   * Login with email/password
   * @param dto - Login credentials
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns Auth response with user and tokens
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResponseDto> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.login(dto, metadata);

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user as UserResponseDto,
    };
  }

  /**
   * Refresh access token
   * Rotates refresh token for security
   * @param req - Request with refresh token payload
   * @param dto - Refresh token DTO
   * @returns New token pair
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  async refresh(
    @Req() req: RefreshRequest,
    @Body() dto: RefreshTokenDto,
  ): Promise<TokensResponseDto> {
    const tokens = await this.authService.refreshTokens(
      req.user.sub,
      req.user.sessionId,
      req.user.refreshToken,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout user
   * Invalidates the session
   * @param dto - Contains refresh token to invalidate
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /**
   * Google OAuth mock endpoint
   * For development/testing - accepts mock JSON token
   *
   * @param dto - Contains mock Google ID token (JSON string)
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns Auth response with user and tokens
   *
   * @todo Replace with real Google OAuth flow:
   * ```
   * @Get('google')
   * @UseGuards(GoogleAuthGuard)
   * googleAuth() {}
   *
   * @Get('google/callback')
   * @UseGuards(GoogleAuthGuard)
   * googleCallback(@Req() req) {
   *   return this.authService.authenticateOAuth('google', req.user);
   * }
   * ```
   */
  @Post('google/mock')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { ttl: RATE_LIMIT.AUTH_TTL * 1000, limit: RATE_LIMIT.AUTH_LIMIT },
  })
  async googleMock(
    @Body() dto: GoogleMockDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResponseDto> {
    const metadata: ISessionMetadata = {
      userAgent,
      ipAddress: ip,
    };

    const result = await this.authService.authenticateOAuth(
      'google',
      dto.googleIdToken,
      metadata,
    );

    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user as UserResponseDto,
    };
  }

  /**
   * Get current user profile
   * @param req - Request with authenticated user
   * @returns User profile without sensitive data
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthenticatedRequest): Promise<UserResponseDto> {
    const user = await this.authService.getMe(req.user.sub);
    return user as UserResponseDto;
  }
}
