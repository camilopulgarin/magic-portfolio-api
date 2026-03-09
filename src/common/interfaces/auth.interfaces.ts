/**
 * Authentication-related interfaces
 * Following Interface Segregation Principle (ISP) - small, focused interfaces
 */

/**
 * JWT Payload structure for access tokens
 */
export interface IJwtPayload {
  /** User's unique identifier */
  sub: string;
  /** User's email address */
  email: string;
  /** User's username */
  username: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * JWT Payload for refresh tokens
 */
export interface IJwtRefreshPayload {
  /** User's unique identifier */
  sub: string;
  /** Session identifier */
  sessionId: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Authentication tokens pair returned after login/register
 */
export interface IAuthTokens {
  /** Short-lived access token (15 minutes) */
  accessToken: string;
  /** Long-lived refresh token (7 days) */
  refreshToken: string;
}

/**
 * Authentication result with user data and tokens
 */
export interface IAuthResult {
  /** Authenticated user data */
  user: IUserPublic;
  /** Access and refresh tokens */
  tokens: IAuthTokens;
}

/**
 * Request context with authenticated user
 */
export interface IAuthenticatedRequest extends Request {
  /** Authenticated user from JWT */
  user: IJwtPayload;
}

/**
 * Request context for refresh token operations
 */
export interface IRefreshTokenRequest extends Request {
  /** Refresh token payload */
  user: IJwtRefreshPayload;
}

/**
 * Public user data (excludes sensitive fields like passwordHash)
 */
export interface IUserPublic {
  id: string;
  email: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
}

/**
 * Session metadata for tracking active sessions
 */
export interface ISessionMetadata {
  /** User agent string from request */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
}
