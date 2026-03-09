/**
 * Application-wide constants
 */

/**
 * JWT configuration constants
 */
export const JWT = {
  /** Access token expiration time */
  ACCESS_TOKEN_EXPIRY: '15m',
  /** Refresh token expiration time */
  REFRESH_TOKEN_EXPIRY: '7d',
  /** Refresh token expiration in milliseconds */
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Bcrypt configuration
 */
export const BCRYPT = {
  /** Number of salt rounds for password hashing */
  SALT_ROUNDS: 12,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  /** Default time window in seconds */
  TTL: 60,
  /** Default max requests per window */
  LIMIT: 10,
  /** Auth endpoints - stricter limits */
  AUTH_TTL: 60,
  AUTH_LIMIT: 5,
} as const;
