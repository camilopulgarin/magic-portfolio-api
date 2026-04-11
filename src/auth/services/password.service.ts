import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BCRYPT } from '../../common/constants';

/**
 * Password service - handles password hashing and comparison
 * Single Responsibility: Only handles password operations
 */
@Injectable()
export class PasswordService {
  /**
   * Hash a plain text password
   * @param password - Plain text password
   * @returns Hashed password
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hash
   * @param password - Plain text password
   * @param hash - Stored password hash
   * @returns True if passwords match
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
