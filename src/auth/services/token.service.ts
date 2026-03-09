import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JWT } from '../../common/constants';
import {
  IAuthTokens,
  IJwtPayload,
  IJwtRefreshPayload,
} from '../../common/interfaces/auth.interfaces';

/**
 * Token service - responsible for JWT generation and verification
 * Single Responsibility: Only handles token operations
 */
@Injectable()
export class TokenService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshTokenSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  /**
   * Generate access and refresh tokens for a user
   * @param userId - User's UUID
   * @param email - User's email
   * @param username - User's username
   * @param sessionId - Session UUID for refresh token
   * @returns Access and refresh token pair
   */
  async generateTokens(
    userId: string,
    email: string,
    username: string,
    sessionId: string,
  ): Promise<IAuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, email, username),
      this.generateRefreshToken(userId, sessionId),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Generate an access token (short-lived: 15 minutes)
   * @param userId - User's UUID
   * @param email - User's email
   * @param username - User's username
   * @returns Signed JWT access token
   */
  async generateAccessToken(
    userId: string,
    email: string,
    username: string,
  ): Promise<string> {
    const payload: IJwtPayload = {
      sub: userId,
      email,
      username,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.accessTokenSecret,
      expiresIn: JWT.ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Generate a refresh token (long-lived: 7 days)
   * @param userId - User's UUID
   * @param sessionId - Session UUID
   * @returns Signed JWT refresh token
   */
  async generateRefreshToken(
    userId: string,
    sessionId: string,
  ): Promise<string> {
    const payload: IJwtRefreshPayload = {
      sub: userId,
      sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.refreshTokenSecret,
      expiresIn: JWT.REFRESH_TOKEN_EXPIRY,
    });
  }

  /**
   * Verify and decode an access token
   * @param token - JWT access token
   * @returns Decoded payload if valid
   * @throws Error if token is invalid or expired
   */
  async verifyAccessToken(token: string): Promise<IJwtPayload> {
    return this.jwtService.verifyAsync<IJwtPayload>(token, {
      secret: this.accessTokenSecret,
    });
  }

  /**
   * Verify and decode a refresh token
   * @param token - JWT refresh token
   * @returns Decoded payload if valid
   * @throws Error if token is invalid or expired
   */
  async verifyRefreshToken(token: string): Promise<IJwtRefreshPayload> {
    return this.jwtService.verifyAsync<IJwtRefreshPayload>(token, {
      secret: this.refreshTokenSecret,
    });
  }

  /**
   * Calculate refresh token expiration date
   * @returns Date when refresh token expires
   */
  getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + JWT.REFRESH_TOKEN_EXPIRY_MS);
  }
}
