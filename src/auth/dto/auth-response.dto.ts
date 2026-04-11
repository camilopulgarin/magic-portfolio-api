import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IUserPublic } from '../../common/interfaces/auth.interfaces';

/**
 * Response DTO for user data
 * Excludes sensitive fields like passwordHash
 */
export class UserResponseDto implements IUserPublic {
  @ApiProperty({
    description: 'Unique user identifier (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @Expose()
  fullName: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'johndoe',
  })
  @Expose()
  username: string;

  @ApiPropertyOptional({
    description: 'URL of the user avatar image',
    example: 'https://example.com/avatars/johndoe.jpg',
    nullable: true,
  })
  @Expose()
  avatarUrl: string | null;

  @ApiPropertyOptional({
    description: 'User biography or description',
    example: 'Full-stack developer passionate about clean code',
    nullable: true,
  })
  @Expose()
  bio: string | null;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the user email has been verified',
    example: false,
  })
  @Expose()
  isVerified: boolean;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2026-01-15T10:30:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @Exclude()
  passwordHash?: string;

  @Exclude()
  updatedAt?: Date;
}

/**
 * Response DTO for authentication endpoints
 * Returns tokens and user data after successful authentication
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (expires in 15 minutes)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token (expires in 7 days)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  refreshToken: string;

  @ApiProperty({
    description: 'Authenticated user profile data',
    type: UserResponseDto,
  })
  @Expose()
  user: UserResponseDto;
}

/**
 * Response DTO for tokens only (used in refresh)
 */
export class TokensResponseDto {
  @ApiProperty({
    description: 'New JWT access token (expires in 15 minutes)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  accessToken: string;

  @ApiProperty({
    description: 'New JWT refresh token (rotated, expires in 7 days)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  refreshToken: string;
}

/**
 * Generic API response wrapper
 */
export class ApiResponseDto<T> {
  @ApiProperty({
    description: 'Indicates if the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({ description: 'Response payload' })
  data: T;

  @ApiPropertyOptional({
    description: 'Optional message with additional context',
    example: 'User created successfully',
  })
  message?: string;
}
