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
  Req,
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
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /**
   * Google OAuth mock endpoint
   * For development/testing - accepts mock JSON token
   *
   * @todo Replace with real Google OAuth flow
   */
  @Post('google/mock')
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
    summary: 'Google OAuth mock login',
    description:
      'Development-only endpoint that simulates Google OAuth login. Accepts a JSON string with Google user data (sub, email, name, picture). Will be replaced with real OAuth flow in production.',
  })
  @ApiBody({ type: GoogleMockDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OAuth authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid Google ID token format',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
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
}
