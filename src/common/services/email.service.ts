import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendResetCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Use the verification code below:</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h1 style="color: #333; margin: 0; text-align: center; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${code}. This code will expire in 15 minutes.`,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendInterviewInvitation(options: {
    to: string;
    talentName?: string;
    recruiterName?: string;
    missionTitle?: string;
    scheduledAt: Date;
    joinUrl: string;
    provider: 'ZOOM' | 'MEET';
  }): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM');

    const dateStr = options.scheduledAt.toLocaleString('fr-FR', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `Invitation à une interview - ${
      options.missionTitle || 'Nouvelle mission'
    }`;

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Invitation à une interview</h2>
          <p>Bonjour ${options.talentName || ''},</p>
          <p>Vous avez été invité(e) à une interview pour la mission <strong>${
            options.missionTitle || ''
          }</strong>.</p>
          <p><strong>Date et heure :</strong> ${dateStr} (UTC)</p>
          <p><strong>Plateforme :</strong> ${options.provider}</p>
          <p>
            <a href="${options.joinUrl}" style="background-color:#0b5cff;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;">
              Rejoindre la réunion
            </a>
          </p>
          <p>Si le bouton ne fonctionne pas, copiez/collez ce lien dans votre navigateur :</p>
          <p><a href="${options.joinUrl}">${options.joinUrl}</a></p>
          <p>Cordialement,<br/>${
            options.recruiterName || 'Votre recruteur'
          }</p>
        </div>
      `;

    await this.transporter.sendMail({
      from,
      to: options.to,
      subject,
      html,
    });
  }
}
