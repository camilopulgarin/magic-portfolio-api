/**
 * User-related interfaces following Interface Segregation Principle
 */

import { IUserPublic } from './auth.interfaces';

/**
 * User entity as stored in database
 */
export interface IUser {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create a new user
 */
export interface ICreateUser {
  email: string;
  passwordHash?: string;
  fullName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
}

/**
 * Data for updating an existing user
 */
export interface IUpdateUser {
  email?: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

/**
 * User repository interface - abstraction for database operations
 * Following Dependency Inversion Principle (DIP) and Liskov Substitution Principle (LSP)
 */
export interface IUsersRepository {
  /**
   * Find a user by their unique ID
   * @param id - User's UUID
   * @returns User if found, null otherwise
   */
  findById(id: string): Promise<IUser | null>;

  /**
   * Find a user by their email address
   * @param email - User's email
   * @returns User if found, null otherwise
   */
  findByEmail(email: string): Promise<IUser | null>;

  /**
   * Find a user by their username
   * @param username - User's username
   * @returns User if found, null otherwise
   */
  findByUsername(username: string): Promise<IUser | null>;

  /**
   * Create a new user in the database
   * @param data - User creation data
   * @returns Created user
   */
  create(data: ICreateUser): Promise<IUser>;

  /**
   * Update an existing user
   * @param id - User's UUID
   * @param data - Fields to update
   * @returns Updated user
   */
  update(id: string, data: IUpdateUser): Promise<IUser>;

  /**
   * Find user by email or username for registration validation
   * @param email - Email to check
   * @param username - Username to check
   * @returns User if either email or username exists
   */
  findByEmailOrUsername(email: string, username: string): Promise<IUser | null>;

  /**
   * Update the hashed password of a user
   * @param id - User's UUID
   * @param passwordHash - New bcrypt password hash
   */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

/**
 * Session repository interface
 */
export interface ISessionsRepository {
  /**
   * Create a new session
   * @param userId - User's UUID
   * @param refreshToken - Hashed refresh token
   * @param expiresAt - Session expiration date
   * @param metadata - Optional session metadata
   * @returns Created session ID
   */
  create(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<string>;

  /**
   * Find session by refresh token
   * @param refreshToken - Hashed refresh token
   * @returns Session with user data if found
   */
  findByRefreshToken(
    refreshToken: string,
  ): Promise<{ id: string; userId: string; expiresAt: Date } | null>;

  /**
   * Delete a session by ID
   * @param id - Session UUID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all sessions for a user
   * @param userId - User's UUID
   */
  deleteAllForUser(userId: string): Promise<void>;

  /**
   * Update session with new refresh token (rotation)
   * @param id - Session UUID
   * @param refreshToken - New hashed refresh token
   * @param expiresAt - New expiration date
   */
  updateRefreshToken(
    id: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void>;
}

/**
 * Injection token for IUsersRepository
 */
export const USERS_REPOSITORY = 'USERS_REPOSITORY';

/**
 * Injection token for ISessionsRepository
 */
export const SESSIONS_REPOSITORY = 'SESSIONS_REPOSITORY';

/**
 * Password reset token entity as stored in database
 */
export interface IPasswordResetToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/**
 * Password reset tokens repository interface
 * Follows ISP: only methods required by the password-reset flow
 */
export interface IPasswordResetTokensRepository {
  /**
   * Persist a new reset token for a user
   * @param userId - Owner's UUID
   * @param tokenHash - SHA-256 hash of the plain token
   * @param expiresAt - Token expiry date
   */
  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<IPasswordResetToken>;

  /**
   * Look up a token by its hash
   * @param tokenHash - SHA-256 hash of the plain token
   * @returns Token record if found, null otherwise
   */
  findByTokenHash(tokenHash: string): Promise<IPasswordResetToken | null>;

  /**
   * Mark a token as consumed so it cannot be reused
   * @param id - Token UUID
   */
  markAsUsed(id: string): Promise<void>;

  /**
   * Remove all pending reset tokens for a user
   * Called before issuing a new token to enforce one-active-token policy
   * @param userId - User's UUID
   */
  deleteByUserId(userId: string): Promise<void>;
}

/** Injection token for IPasswordResetTokensRepository */
export const PASSWORD_RESET_TOKENS_REPOSITORY =
  'PASSWORD_RESET_TOKENS_REPOSITORY';

/**
 * Maps IUser to IUserPublic (excludes sensitive data)
 */
export function toUserPublic(user: IUser): IUserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}
