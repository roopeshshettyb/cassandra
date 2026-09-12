import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConstantsService } from '../common/constants/constants.service';
import * as fs from 'fs';
import * as path from 'path';

/** The OTP chip's background in otpEmailTemplate.html — keep the two in sync. */
const OTP_CHIP_BACKGROUND = '#121212';

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
      PRIMARY_COLOR: pub.THEME_DEFAULTS.PRIMARY_COLOR,
      SECONDARY_COLOR: pub.THEME_DEFAULTS.SECONDARY_COLOR,
      PRIMARY_HOVER_COLOR: pub.THEME_DEFAULTS.PRIMARY_HOVER_COLOR,
      YEAR: `${new Date().getFullYear()}`,
      CONTENT: contentHtml,
      ...extraVars,
    };
    const base = this.readTemplate('baseEmailTemplate.html');
    return this.render(base, vars);
  }

  /** WCAG relative luminance of a #rrggbb colour. Returns null if it cannot be parsed. */
  private luminance(hex: string): number | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '');
    if (!m) return null;
    const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(m[1].slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * The OTP sits on a fixed near-black chip, so a tenant whose brand colour is dark would
   * render an unreadable code — in the one email every user has to read. Fall back to white
   * below the WCAG AA ratio of 4.5:1 rather than let the brand win over legibility.
   */
  private otpColorOn(background: string, brand: string): string {
    const bg = this.luminance(background);
    const fg = this.luminance(brand);
    if (bg === null || fg === null) return '#ffffff';
    const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    return ratio >= 4.5 ? brand : '#ffffff';
  }

  buildOtpEmailHtml(params: { otp: string; otpExpiryMinutes: number }): string {
    const pub = this.constantsService.public;
    const inner = this.readTemplate('otpEmailTemplate.html');
    const contentHtml = this.render(inner, {
      APP_NAME: pub.APP_NAME,
      // Keep in sync with the chip background in otpEmailTemplate.html.
      OTP_COLOR: this.otpColorOn(OTP_CHIP_BACKGROUND, pub.THEME_DEFAULTS.PRIMARY_COLOR),
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
    const { NODE_ENV, NODE_ENV_AUTOMATION_TEST } = this.constantsService.private;
    if (NODE_ENV === NODE_ENV_AUTOMATION_TEST) return;
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
