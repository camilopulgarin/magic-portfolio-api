import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for user login
 */
export class LoginDto {
  /**
   * User's email address
   * @example "user@example.com"
   */
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /**
   * User's password
   * @example "SecurePass123"
   */
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
