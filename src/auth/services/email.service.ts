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
  private readonly resend?: Resend;
  private readonly brevoApiKey?: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly provider: 'resend' | 'brevo';

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.getOrThrow<string>('EMAIL_FROM');
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ?? 'Magic Portfolio';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    const configuredProvider = this.configService
      .get<string>('EMAIL_PROVIDER')
      ?.toLowerCase();

    const hasBrevoConfig = !!this.configService.get<string>('BREVO_API_KEY');

    const useBrevo =
      configuredProvider === 'brevo' || (!configuredProvider && hasBrevoConfig);

    if (useBrevo) {
      this.provider = 'brevo';
      this.brevoApiKey = this.configService.getOrThrow<string>('BREVO_API_KEY');
      this.logger.log(`Email provider configured: ${this.provider}`);
      return;
    }

    this.provider = 'resend';
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.logger.log(`Email provider configured: ${this.provider}`);
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
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your password - Magic Portfolio';
    const html = this.buildResetEmailHtml(fullName, resetUrl);
    const text = this.buildResetEmailText(fullName, resetUrl);

    try {
      if (this.provider === 'brevo') {
        return await this.sendWithBrevo(to, subject, html, text);
      }

      const { data, error } = await this.resend!.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send password reset email to ${to}`, {
          provider: this.provider,
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
        provider: this.provider,
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

  private async sendWithBrevo(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.brevoApiKey!,
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromAddress },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const errorMessage = this.extractBrevoErrorMessage(
        response.status,
        responseText,
      );
      this.logger.error(`Failed to send password reset email to ${to}`, {
        provider: this.provider,
        errorMessage,
        fromAddress: this.fromAddress,
        recipient: to,
      });
      return {
        success: false,
        message: `Email delivery failed: ${errorMessage}`,
      };
    }

    this.logger.log(`Password reset email sent to ${to}`, {
      provider: this.provider,
      recipient: to,
    });

    return { success: true };
  }

  private extractBrevoErrorMessage(
    status: number,
    responseText: string,
  ): string {
    try {
      const parsed = JSON.parse(responseText) as
        | { message?: unknown }
        | { code?: unknown; message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      // Fallback to a generic status-based message when payload is not JSON.
    }

    return `Brevo API request failed with status ${status}`;
  }

  private buildResetEmailText(fullName: string, resetUrl: string): string {
    return [
      `Hi ${fullName},`,
      '',
      'We received a request to reset the password for your account.',
      'Use the link below to set a new password. This link expires in 1 hour.',
      '',
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n');
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
