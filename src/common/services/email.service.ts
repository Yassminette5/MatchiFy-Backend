import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Send the reset/verification code to the user's email.
   * - If SMTP settings are present in env, uses nodemailer to send the email.
   * - Otherwise falls back to logging the code (useful for development/tests).
   */
  async sendResetCode(email: string, code: string): Promise<boolean> {
    const subject = 'Matchify — Verification code';
    const text = `Your verification code is: ${code}`;
    const html = `<p>Your verification code is: <strong>${code}</strong></p>`;

    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      // No SMTP configured — log to console (development fallback)
      this.logger.warn('SMTP not configured — logging verification code instead of sending');
      this.logger.log({ to: email, subject, text });
      return true;
    }

    try {
      // dynamic import so code still works if nodemailer isn't installed in tests
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });

      const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@matchify.local';

      await transporter.sendMail({ from, to: email, subject, text, html });
      this.logger.log(`Verification code sent to ${email}`);
      return true;
    } catch (err) {
      this.logger.error('Failed to send verification email — falling back to console', err as any);
      this.logger.log({ to: email, subject, text });
      return false;
    }
  }
}