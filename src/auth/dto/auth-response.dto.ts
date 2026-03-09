import { Exclude, Expose } from 'class-transformer';
import { IUserPublic } from '../../common/interfaces/auth.interfaces';

/**
 * Response DTO for authentication endpoints
 * Uses class-transformer for serialization
 */
export class AuthResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;

  @Expose()
  user: UserResponseDto;
}

/**
 * Response DTO for user data
 * Excludes sensitive fields like passwordHash
 */
export class UserResponseDto implements IUserPublic {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  fullName: string;

  @Expose()
  username: string;

  @Expose()
  avatarUrl: string | null;

  @Expose()
  bio: string | null;

  @Expose()
  isActive: boolean;

  @Expose()
  isVerified: boolean;

  @Expose()
  createdAt: Date;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  updatedAt?: Date;
}

/**
 * Response DTO for tokens only (used in refresh)
 */
export class TokensResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;
}

/**
 * Generic API response wrapper
 */
export class ApiResponseDto<T> {
  success: boolean;
  data: T;
  message?: string;
}
