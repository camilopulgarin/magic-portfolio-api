import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Google OAuth mock endpoint
 * In production, this would be replaced with passport-google-oauth20
 */
export class GoogleMockDto {
  /**
   * Mock Google ID token (JSON string with user data)
   * @example '{"sub":"123456","email":"user@gmail.com","name":"John Doe","picture":"https://..."}'
   */
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
