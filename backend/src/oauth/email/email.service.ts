import { Injectable } from '@nestjs/common';
import { AccountsService } from '../../accounts/accounts.service';
import { MailerService } from '../../mailer/mailer.service';
import { ConstantsService } from '../../common/constants/constants.service';

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtp(): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

@Injectable()
export class EmailService {
  constructor(private accountsService: AccountsService, private mailerService: MailerService, private constantsService: ConstantsService) {}

  async sendOtp(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error('Email is required');
    }
    const uuid = `email:${normalized}`;
    let account = await this.accountsService.findById(uuid);
    if (!account) {
      const [created] = await this.accountsService.upsert({
        uuid,
        email: normalized,
        oauthMeta: {},
      });
      account = created;
    }
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await this.accountsService.update({ otp, otpExpiresAt }, { uuid });

    const appName = this.constantsService.public.APP_NAME;
    const subject = `${appName} - Your sign in code`;
    const text = `Your verification code is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
    const html = this.mailerService.buildOtpEmailHtml({ otp, otpExpiryMinutes: OTP_EXPIRY_MINUTES });
    await this.mailerService.sendMail({
      to: normalized,
      subject,
      text,
      html,
    });
  }

  async handleCallback(body: any): Promise<{
    uuid: string;
    oauthMeta: any;
    email: string;
    name: string;
    profilePicUrl: string;
    username: string;
    description: string;
  }> {
    const { email: rawEmail, otp } = body;
    if (!rawEmail || !otp) {
      throw new Error('Missing email or otp for email auth');
    }
    const normalized = normalizeEmail(rawEmail);
    const uuid = `email:${normalized}`;
    const account = await this.accountsService.findById(uuid);
    if (!account) {
      throw new Error('Invalid email or OTP');
    }
    if (account.otp !== otp) {
      throw new Error('Invalid email or OTP');
    }
    if (!account.otpExpiresAt || new Date(account.otpExpiresAt) < new Date()) {
      throw new Error('OTP has expired');
    }
    await this.accountsService.update({ otp: null, otpExpiresAt: null }, { uuid });

    return {
      uuid: normalized,
      oauthMeta: {},
      email: normalized,
      name: account.name || '',
      profilePicUrl: account.profilePicUrl || '',
      username: '',
      description: '',
    };
  }
}
