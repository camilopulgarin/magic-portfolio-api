import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for changing the authenticated user's password
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current account password for verification',
    example: 'CurrentPass123',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    description:
      'New password (8-72 chars, must include uppercase, lowercase, and number)',
    example: 'NewSecurePass456',
    format: 'password',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(72, { message: 'New password must not exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'New password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
