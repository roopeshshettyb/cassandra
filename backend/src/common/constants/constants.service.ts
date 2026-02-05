import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCOUNT_ROLES } from './account-roles.constants';

const PLATFORM_DATA: any = {
  google: {
    label: 'Google',
    disabled: false,
    social: false,
  },
  email: {
    label: 'Email',
    disabled: false,
    social: false,
  },
  // x: {
  //   label: 'X',
  //   disabled: true,
  //   social: true,
  //   adSpaces: {
  //     badge: {
  //       label: 'Badge',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     header: {
  //       label: 'Header',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     linkInBio: {
  //       label: 'Link In Bio',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     textPost: {
  //       label: 'Text Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     videoPost: {
  //       label: 'Video Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //   },
  // },
  // instagram: {
  //   label: 'Instagram',
  //   disabled: true,
  //   social: true,
  //   adSpaces: {
  //     linkInBio: {
  //       label: 'Link In Bio',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     textPost: {
  //       label: 'Text Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     videoPost: {
  //       label: 'Video Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     story: {
  //       label: 'Story',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     reel: {
  //       label: 'Reel',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //   },
  // },
  // threads: {
  //   label: 'Threads',
  //   disabled: true,
  //   social: true,
  //   adSpaces: {
  //     badge: {
  //       label: 'Badge',
  //       status: 'AVAILABLE',
  //     },
  //     header: {
  //       label: 'Header',
  //       status: 'AVAILABLE',
  //     },
  //     linkInBio: {
  //       label: 'Link In Bio',
  //       status: 'AVAILABLE',
  //     },
  //     textPost: {
  //       label: 'Text Post',
  //       status: 'AVAILABLE',
  //     },
  //     videoPost: {
  //       label: 'Video Post',
  //       status: 'AVAILABLE',
  //     },
  //     story: {
  //       label: 'Story',
  //       status: 'AVAILABLE',
  //     },
  //   },
  // },
  // linkedin: {
  //   label: 'LinkedIn',
  //   disabled: true,
  //   social: true,
  //   adSpaces: {
  //     badge: {
  //       label: 'Badge',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     header: {
  //       label: 'Header',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     linkInBio: {
  //       label: 'Link In Bio',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     textPost: {
  //       label: 'Text Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     videoPost: {
  //       label: 'Video Post',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     article: {
  //       label: 'Article',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //   },
  // },
  // github: {
  //   label: 'GitHub',
  //   disabled: true,
  //   social: true,
  //   adSpaces: {
  //     badge: {
  //       label: 'Badge',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     header: {
  //       label: 'Header',
  //       status: 'AVAILABLE',
  //       requiresMedia: true,
  //     },
  //     linkInBio: {
  //       label: 'Link In Bio',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     readme: {
  //       label: 'README',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //     repository: {
  //       label: 'Repository',
  //       status: 'AVAILABLE',
  //       requiresMedia: false,
  //     },
  //   },
  // },
};
const LOGIN_OPTIONS: any[] = [];
for (const [provider, data] of Object.entries(PLATFORM_DATA)) {
  const platformData: any = data;
  LOGIN_OPTIONS.push({
    provider,
    label: platformData.label,
    disabled: platformData.disabled,
    social: platformData.social,
  });
}

@Injectable()
export class ConstantsService {
  constructor(private configService: ConfigService) {}

  get public() {
    return {
      // App Configuration
      APP_NAME: this.configService.get<string>('APP_NAME', 'Samantha'),
      TAGLINE: this.configService.get<string>('TAGLINE', 'With you, always'),
      DESCRIPTION: this.configService.get<string>('DESCRIPTION', 'Samantha is your personal concierge and will make your stay a breeze.'),
      X_API_URL: 'https://api.twitter.com',
      LOGO: 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg',
      PROD_FRONTEND_URL: this.configService.get<string>('PROD_FRONTEND_URL', 'https://samantha.flashpact.in'),
      HERO: 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg',

      ACCOUNT_ROLES,

      // Platform Configuration
      PLATFORM_DATA_MAPPING: {
        ...PLATFORM_DATA,
        general: {
          LOGIN_OPTIONS,
        },
      },
    };
  }

  get private() {
    return {
      // Environment Configuration
      NODE_ENV: this.configService.get<string>('NODE_ENV', 'development'),
      BACKEND_PORT: this.configService.get<number>('PORT', 3000),
      FRONTEND_URL: this.configService.get<string>('FRONTEND_URL'),
      BACKEND_URL: this.configService.get<string>('BACKEND_URL'),
      GOOGLE_CLIENT_ID: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      X_CLIENT_ID: this.configService.get<string>('X_CLIENT_ID'),

      // Database Configuration
      DB_HOST: this.configService.get<string>('DB_HOST'),
      DB_PORT: this.configService.get<number>('DB_PORT'),
      DB_USERNAME: this.configService.get<string>('DB_USERNAME'),
      DB_PASSWORD: this.configService.get<string>('DB_PASSWORD'),
      DB_NAME: this.configService.get<string>('DB_NAME'),
      DB_SSL: this.configService.get<string>('DB_SSL', 'false') === 'true' || this.configService.get<string>('DB_SSL', 'false') === '1',
      DB_POOL_SIZE: parseInt(this.configService.get('DB_POOL_SIZE') || '5', 10),
      DB_LOGGING: this.configService.get<string>('DB_LOGGING', 'false') === 'true',

      // AWS Configuration
      AWS_ACCESS_KEY_ID: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      AWS_SECRET_ACCESS_KEY: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      AWS_REGION: this.configService.get<string>('AWS_DEFAULT_REGION') || this.configService.get<string>('AWS_REGION', 'us-east-1'),
      AWS_S3_BUCKET_NAME: this.configService.get<string>('AWS_BUCKET_NAME') || this.configService.get<string>('AWS_S3_BUCKET_NAME'),
      AWS_S3_PUBLIC_BUCKET_NAME: this.configService.get<string>('AWS_S3_PUBLIC_BUCKET_NAME'),

      // JWT Configuration
      JWT_SECRET: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      JWT_EXPIRY_DAYS: this.configService.get<number>('JWT_EXPIRY_DAYS', 7),

      // Google OAuth Configuration
      GOOGLE_CLIENT_SECRET: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      GOOGLE_CALLBACK_URL: this.configService.get<string>('GOOGLE_CALLBACK_URL'),

      // X OAuth Configuration
      X_CLIENT_SECRET: this.configService.get<string>('X_CLIENT_SECRET'),

      // PhonePe Configuration
      PHONEPE_CLIENT_ID: this.configService.get<string>('PHONEPE_CLIENT_ID'),
      PHONEPE_CLIENT_SECRET: this.configService.get<string>('PHONEPE_CLIENT_SECRET'),
      PHONEPE_CLIENT_VERSION: this.configService.get<number>('PHONEPE_CLIENT_VERSION', 1),
      PHONEPE_MERCHANT_ID: this.configService.get<string>('PHONEPE_MERCHANT_ID') || this.configService.get<string>('PHONEPE_CLIENT_ID'),

      // RapidAPI Configuration
      RAPID_API_KEY: this.configService.get<string>('RAPID_API_KEY'),

      // GoDaddy Email (Mailer)
      GODADDY_EMAIL: this.configService.get<string>('GODADDY_EMAIL'),
      GODADDY_PASSWORD: this.configService.get<string>('GODADDY_PASSWORD'),
    };
  }
}
