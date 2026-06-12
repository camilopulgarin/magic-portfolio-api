import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PASSWORD_RESET } from '../common/constants';
import type {
  IAuthResult,
  IAuthTokens,
  ISessionMetadata,
  IUserPublic,
} from '../common/interfaces/auth.interfaces';
import type { IEmailService } from '../common/interfaces/email.interfaces';
import { EMAIL_SERVICE } from '../common/interfaces/email.interfaces';
import type {
  IOAuthAccountsRepository,
  IOAuthProfile,
} from '../common/interfaces/oauth.interfaces';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../common/interfaces/oauth.interfaces';
import type {
  IPasswordResetTokensRepository,
  ISessionsRepository,
  IUsersRepository,
} from '../common/interfaces/user.interfaces';
import {
  PASSWORD_RESET_TOKENS_REPOSITORY,
  SESSIONS_REPOSITORY,
  toUserPublic,
  USERS_REPOSITORY,
} from '../common/interfaces/user.interfaces';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { OAuthStrategyRegistry } from './strategies/oauth-registry';

/**
 * Auth service - orchestrates authentication flows
 * Single Responsibility: Coordinates auth operations between services
 * Depends on abstractions (interfaces) not implementations (DIP)
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: ISessionsRepository,
    @Inject(OAUTH_ACCOUNTS_REPOSITORY)
    private readonly oauthAccountsRepository: IOAuthAccountsRepository,
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly passwordResetTokensRepository: IPasswordResetTokensRepository,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: IEmailService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly oauthRegistry: OAuthStrategyRegistry,
  ) {}

  /**
   * Register a new user with email/password
   * @param dto - Registration data
   * @param metadata - Session metadata (user agent, IP)
   * @returns Auth result with user and tokens
   * @throws ConflictException if email or username already exists
   */
  async register(
    dto: RegisterDto,
    metadata?: ISessionMetadata,
  ): Promise<IAuthResult> {
    // Check for existing user
    const existingUser = await this.usersRepository.findByEmailOrUsername(
      dto.email,
      dto.username,
    );

    if (existingUser) {
      if (existingUser.email.toLowerCase() === dto.email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Create user
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      username: dto.username,
    });

    // Create session and generate tokens
    const sessionId = await this.sessionsRepository.create(
      user.id,
      '', // Will be updated with actual token
      this.tokenService.getRefreshTokenExpiryDate(),
      metadata,
    );

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      user.username,
      sessionId,
    );

    // Update session with refresh token
    await this.sessionsRepository.updateRefreshToken(
      sessionId,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiryDate(),
    );

    return {
      user: toUserPublic(user),
      tokens,
    };
  }

  /**
   * Login with email/password
   * @param dto - Login credentials
   * @param metadata - Session metadata (user agent, IP)
   * @returns Auth result with user and tokens
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(
    dto: LoginDto,
    metadata?: ISessionMetadata,
  ): Promise<IAuthResult> {
    // Find user by email
    const user = await this.usersRepository.findByEmail(dto.email);

    // Use generic error message to prevent email enumeration
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create session and generate tokens
    const sessionId = await this.sessionsRepository.create(
      user.id,
      '', // Will be updated with actual token
      this.tokenService.getRefreshTokenExpiryDate(),
      metadata,
    );

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      user.username,
      sessionId,
    );

    // Update session with refresh token
    await this.sessionsRepository.updateRefreshToken(
      sessionId,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiryDate(),
    );

    return {
      user: toUserPublic(user),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   * @param userId - User ID from refresh token
   * @param sessionId - Session ID from refresh token
   * @param oldRefreshToken - Current refresh token to be rotated
   * @returns New token pair
   * @throws UnauthorizedException if session is invalid
   */
  async refreshTokens(
    userId: string,
    sessionId: string,
    oldRefreshToken: string,
  ): Promise<IAuthTokens> {
    // Get user
    const user = await this.usersRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    // Generate new tokens
    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      user.username,
      sessionId,
    );

    // Rotate refresh token in session
    await this.sessionsRepository.updateRefreshToken(
      sessionId,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiryDate(),
    );

    return tokens;
  }

  /**
   * Logout user by deleting their session
   * @param refreshToken - Refresh token to invalidate
   */
  async logout(refreshToken: string): Promise<void> {
    const session =
      await this.sessionsRepository.findByRefreshToken(refreshToken);

    if (session) {
      await this.sessionsRepository.delete(session.id);
    }
  }

  /**
   * Authenticate via OAuth provider
   * @param provider - OAuth provider name
   * @param token - OAuth token (or mock token for development)
   * @param metadata - Session metadata
   * @returns Auth result with user and tokens
   * @throws BadRequestException if provider is not supported
   */
  async authenticateOAuth(
    provider: string,
    token: string,
    metadata?: ISessionMetadata,
  ): Promise<IAuthResult> {
    // Check if provider is supported
    if (!this.oauthRegistry.isSupported(provider)) {
      throw new BadRequestException(
        `OAuth provider '${provider}' is not supported. ` +
          `Supported providers: ${this.oauthRegistry.getSupportedProviders().join(', ')}`,
      );
    }

    // Get strategy and validate token
    const strategy = this.oauthRegistry.get(provider)!;
    const profile = await strategy.validateAndGetProfile(token);

    // Upsert user and OAuth account
    const userId = await this.oauthAccountsRepository.upsertWithUser(profile);

    // Get user for token generation
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with OAuth');
    }

    // Create session and generate tokens
    const sessionId = await this.sessionsRepository.create(
      user.id,
      '', // Will be updated with actual token
      this.tokenService.getRefreshTokenExpiryDate(),
      metadata,
    );

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      user.username,
      sessionId,
    );

    // Update session with refresh token
    await this.sessionsRepository.updateRefreshToken(
      sessionId,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiryDate(),
    );

    return {
      user: toUserPublic(user),
      tokens,
    };
  }

  /**
   * Authenticate using an already-resolved OAuth profile.
   * Used by the redirect flow where Passport has already validated
   * the authorization code and populated req.user with IOAuthProfile.
   * @param profile - Normalized OAuth profile from Passport strategy
   * @param metadata - Session metadata (user agent, IP)
   * @returns Auth result with user and tokens
   */
  async authenticateOAuthProfile(
    profile: IOAuthProfile,
    metadata?: ISessionMetadata,
  ): Promise<IAuthResult> {
    const userId = await this.oauthAccountsRepository.upsertWithUser(profile);

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with OAuth');
    }

    const sessionId = await this.sessionsRepository.create(
      user.id,
      '',
      this.tokenService.getRefreshTokenExpiryDate(),
      metadata,
    );

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      user.username,
      sessionId,
    );

    await this.sessionsRepository.updateRefreshToken(
      sessionId,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiryDate(),
    );

    return {
      user: toUserPublic(user),
      tokens,
    };
  }

  /**
   * Get current user profile
   * @param userId - User ID from JWT
   * @returns User public profile
   * @throws UnauthorizedException if user not found
   */
  async getMe(userId: string): Promise<IUserPublic> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return toUserPublic(user);
  }

  /**
   * Change the authenticated user's password
   * @param userId - User ID from JWT
   * @param currentPassword - Current plain text password for verification
   * @param newPassword - New plain text password to set
   * @throws UnauthorizedException if user not found or current password is wrong
   * @throws BadRequestException if user has no password (OAuth-only) or new password matches current
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses OAuth authentication and does not have a password',
      );
    }

    const isCurrentPasswordValid = await this.passwordService.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await this.passwordService.compare(
      newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const newPasswordHash = await this.passwordService.hash(newPassword);
    await this.usersRepository.updatePassword(userId, newPasswordHash);
  }

  /**
   * Initiate the password reset flow.
   * Sends an email with a one-time reset link if the account exists.
   * Always returns without error to prevent email enumeration.
   * @param email - Account email address
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);

    // Silently exit for unknown / inactive / OAuth-only accounts
    if (!user || !user.isActive || !user.passwordHash) {
      return;
    }

    // Enforce one active token per user
    await this.passwordResetTokensRepository.deleteByUserId(user.id);

    // Generate a cryptographically secure token; store only its hash
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET.EXPIRY_MS);

    await this.passwordResetTokensRepository.create(
      user.id,
      tokenHash,
      expiresAt,
    );

    const emailResult = await this.emailService.sendPasswordResetEmail(
      user.email,
      plainToken,
      user.fullName,
    );

    // In production we keep anti-enumeration behavior (always silent).
    // In non-production we surface delivery errors to ease debugging.
    if (!emailResult.success) {
      const reason = emailResult.message ?? 'Unknown email delivery error';
      this.logger.error(
        `Password reset email failed for ${user.email}: ${reason}`,
      );

      if (process.env.NODE_ENV !== 'production') {
        throw new BadRequestException(
          `Password reset email could not be sent: ${reason}`,
        );
      }
    }
  }

  /**
   * Complete the password reset flow.
   * Validates the token, updates the password, invalidates all sessions.
   * @param token - Plain-text token from the reset email
   * @param newPassword - The user's new plain-text password
   * @throws BadRequestException if the token is invalid, expired, or already used
   * @throws UnauthorizedException if the associated account is disabled
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken =
      await this.passwordResetTokensRepository.findByTokenHash(tokenHash);

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.usersRepository.findById(resetToken.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or disabled');
    }

    const newPasswordHash = await this.passwordService.hash(newPassword);

    await this.usersRepository.updatePassword(user.id, newPasswordHash);
    await this.passwordResetTokensRepository.markAsUsed(resetToken.id);

    // Invalidate all existing sessions for security
    await this.sessionsRepository.deleteAllForUser(user.id);
  }
}
