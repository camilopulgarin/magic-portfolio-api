import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  IAuthResult,
  IAuthTokens,
  ISessionMetadata,
  IUserPublic,
} from '../common/interfaces/auth.interfaces';
import type { IOAuthAccountsRepository } from '../common/interfaces/oauth.interfaces';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../common/interfaces/oauth.interfaces';
import type {
  ISessionsRepository,
  IUsersRepository,
} from '../common/interfaces/user.interfaces';
import {
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
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: ISessionsRepository,
    @Inject(OAUTH_ACCOUNTS_REPOSITORY)
    private readonly oauthAccountsRepository: IOAuthAccountsRepository,
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
}
