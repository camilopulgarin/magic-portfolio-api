/**
 * Result of an email send operation
 */
export interface EmailSendResult {
  success: boolean;
  message?: string;
}

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
   * @returns Result indicating success or failure with optional message
   */
  sendPasswordResetEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<EmailSendResult>;
}

/** Injection token for the email service */
export const EMAIL_SERVICE = 'EMAIL_SERVICE';
