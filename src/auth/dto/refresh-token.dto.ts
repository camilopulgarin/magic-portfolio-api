import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for token refresh
 */
export class RefreshTokenDto {
  /**
   * Refresh token from previous authentication
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
