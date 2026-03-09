/**
 * OAuth-related interfaces
 * Following Open/Closed Principle (OCP) - extensible for new providers
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'github' | 'linkedin';

/**
 * Normalized profile data from any OAuth provider
 * Common interface for all OAuth strategies
 */
export interface IOAuthProfile {
  /** Provider name (google, github, etc.) */
  provider: OAuthProvider;
  /** User's ID in the provider's system */
  providerUserId: string;
  /** User's email from provider */
  email: string;
  /** User's full name from provider */
  fullName: string;
  /** User's avatar URL from provider */
  avatarUrl?: string;
  /** Raw access token from provider (optional) */
  accessToken?: string;
  /** Raw refresh token from provider (optional) */
  refreshToken?: string;
  /** Token expiration date (optional) */
  expiresAt?: Date;
}

/**
 * OAuth account as stored in database
 */
export interface IOAuthAccount {
  id: string;
  provider: string;
  providerUserId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data for creating/updating OAuth account
 */
export interface IUpsertOAuthAccount {
  provider: OAuthProvider;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * OAuth strategy interface - allows adding new providers without modifying core
 * Following Open/Closed Principle (OCP)
 */
export interface IOAuthStrategy {
  /** Provider identifier */
  readonly provider: OAuthProvider;

  /**
   * Validate and extract profile from OAuth token/code
   * @param token - OAuth token or authorization code
   * @returns Normalized OAuth profile
   */
  validateAndGetProfile(token: string): Promise<IOAuthProfile>;
}

/**
 * OAuth accounts repository interface
 */
export interface IOAuthAccountsRepository {
  /**
   * Find OAuth account by provider and provider user ID
   * @param provider - OAuth provider name
   * @param providerUserId - User's ID in provider's system
   * @returns OAuth account with user data if found
   */
  findByProviderAndId(
    provider: string,
    providerUserId: string,
  ): Promise<(IOAuthAccount & { user: { id: string; email: string } }) | null>;

  /**
   * Create or update OAuth account and associated user
   * @param profile - Normalized OAuth profile
   * @returns User ID (existing or newly created)
   */
  upsertWithUser(profile: IOAuthProfile): Promise<string>;

  /**
   * Link OAuth account to existing user
   * @param userId - User's UUID
   * @param data - OAuth account data
   */
  linkToUser(userId: string, data: IUpsertOAuthAccount): Promise<void>;
}

/**
 * Injection token for IOAuthAccountsRepository
 */
export const OAUTH_ACCOUNTS_REPOSITORY = 'OAUTH_ACCOUNTS_REPOSITORY';

/**
 * Injection token for OAuth strategy registry
 */
export const OAUTH_STRATEGY_REGISTRY = 'OAUTH_STRATEGY_REGISTRY';
