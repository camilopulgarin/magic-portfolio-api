import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { IEmailService } from '../../common/interfaces/email.interfaces';

/**
 * Email service - sends transactional emails via Resend
 * Single Responsibility: only handles email delivery
 * Implements IEmailService (Dependency Inversion)
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.fromAddress = this.configService.getOrThrow<string>('EMAIL_FROM');
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  /**
   * Send a password reset email with a one-time link
   * @param to - Recipient email address
   * @param token - Plain-text reset token
   * @param fullName - Recipient full name for personalisation
   * @returns Object with success status and optional message
   */
  async sendPasswordResetEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<{ success: boolean; message?: string }> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Reset your password – Magic Portfolio',
        html: this.buildResetEmailHtml(fullName, resetUrl),
      });

      if (error) {
        this.logger.error(`Failed to send password reset email to ${to}`, {
          errorName: error.name,
          errorMessage: error.message,
          fromAddress: this.fromAddress,
          recipient: to,
        });
        return {
          success: false,
          message: `Email delivery failed: ${error.message}`,
        };
      }

      this.logger.log(`Password reset email sent to ${to}`, {
        emailId: data?.id,
        recipient: to,
      });

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Unexpected error sending password reset email to ${to}: ${errorMessage}`,
        err instanceof Error ? err.stack : undefined,
      );
      return {
        success: false,
        message: `Email service error: ${errorMessage}`,
      };
    }
  }

  private buildResetEmailHtml(fullName: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Magic Portfolio</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1a1a2e;margin-top:0;">Password reset request</h2>
              <p style="color:#555555;line-height:1.6;">Hi ${this.escapeHtml(fullName)},</p>
              <p style="color:#555555;line-height:1.6;">
                We received a request to reset the password for your account.
                Click the button below to choose a new password. This link expires in
                <strong>1 hour</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                   style="background-color:#4f46e5;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
                  Reset password
                </a>
              </div>
              <p style="color:#888888;font-size:13px;line-height:1.6;">
                If you did not request this, you can safely ignore this email.
                Your password will <strong>not</strong> change unless you click the link above.
              </p>
              <p style="color:#888888;font-size:13px;line-height:1.6;">
                Or copy and paste this URL into your browser:<br />
                <a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9;padding:20px 40px;text-align:center;">
              <p style="color:#aaaaaa;font-size:12px;margin:0;">
                &copy; ${new Date().getFullYear()} Magic Portfolio. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /** Minimal HTML escaping to prevent XSS in the email template */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
