import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Google OAuth mock endpoint
 * In production, this would be replaced with passport-google-oauth20
 */
export class GoogleMockDto {
  @ApiProperty({
    description:
      'Mock Google ID token as JSON string containing user data (sub, email, name, picture)',
    example:
      '{"sub":"123456789","email":"user@gmail.com","name":"John Doe","picture":"https://lh3.googleusercontent.com/photo.jpg"}',
  })
  @IsString()
  @IsNotEmpty({ message: 'Google ID token is required' })
  googleIdToken: string;
}

/**
 * Structure of parsed Google mock token
 */
export interface GoogleMockTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}
