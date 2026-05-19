/**
 * Email service interface - abstraction for sending transactional emails
 * Follows Dependency Inversion Principle: consumers depend on this interface,
 * not on a concrete provider (Resend, SendGrid, etc.)
 */
export interface IEmailService {
  /**
   * Send a password reset email with a one-time link
   * @param to - Recipient email address
   * @param token - Plain-text reset token (not the stored hash)
   * @param fullName - Recipient full name for personalisation
   */
  sendPasswordResetEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<void>;
}

/** Injection token for the email service */
export const EMAIL_SERVICE = 'EMAIL_SERVICE';
