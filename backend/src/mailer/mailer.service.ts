import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConstantsService } from '../common/constants/constants.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter | null = null;
  private templateCache: Record<string, string> = {};

  constructor(private constantsService: ConstantsService) {}

  private getTemplatesDir(): string {
    // In dev: backend/src/mailer/templates
    // In prod: backend/dist/mailer/templates (copied via nest-cli assets)
    return path.join(__dirname, 'templates');
  }

  private readTemplate(filename: string): string {
    if (this.templateCache[filename]) {
      return this.templateCache[filename];
    }
    const filePath = path.join(this.getTemplatesDir(), filename);
    const contents = fs.readFileSync(filePath, 'utf8');
    this.templateCache[filename] = contents;
    return contents;
  }

  private render(template: string, vars: Record<string, string>): string {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
      const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      out = out.replace(re, value);
    }
    return out;
  }

  buildBaseEmailHtml(contentHtml: string, extraVars: Record<string, string> = {}): string {
    const pub = this.constantsService.public;
    const priv = this.constantsService.private;
    const frontendUrl = priv.FRONTEND_URL || 'http://localhost:6768';
    const vars: Record<string, string> = {
      APP_NAME: pub.APP_NAME,
      TAGLINE: pub.TAGLINE || '',
      FRONTEND_URL: frontendUrl,
      LOGO_URL: pub.LOGO,
      YEAR: `${new Date().getFullYear()}`,
      CONTENT: contentHtml,
      ...extraVars,
    };
    const base = this.readTemplate('baseEmailTemplate.html');
    return this.render(base, vars);
  }

  buildOtpEmailHtml(params: { otp: string; otpExpiryMinutes: number }): string {
    const pub = this.constantsService.public;
    const inner = this.readTemplate('otpEmailTemplate.html');
    const contentHtml = this.render(inner, {
      APP_NAME: pub.APP_NAME,
      OTP: params.otp,
      OTP_EXPIRY_MINUTES: `${params.otpExpiryMinutes}`,
    });
    return this.buildBaseEmailHtml(contentHtml);
  }

  private getTransporter(): nodemailer.Transporter {
    const privateConstants = this.constantsService.private;
    const email = privateConstants.GODADDY_EMAIL;
    const password = privateConstants.GODADDY_PASSWORD;
    if (!email || !password) {
      throw new Error('GODADDY_EMAIL and GODADDY_PASSWORD must be set');
    }
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
    });
    return this.transporter;
  }

  async sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    const privateConstants = this.constantsService.private;
    const publicConstants = this.constantsService.public;
    const email = privateConstants.GODADDY_EMAIL;
    const appName = publicConstants.APP_NAME;
    const from = email ? `"${appName}" <${email}>` : 'noreply@example.com';
    const transport = this.getTransporter();
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
