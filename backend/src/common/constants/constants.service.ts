import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_LENGTH = 6;

export enum NotificationTone {
  NONE = 'none',
  GENTLE_CHIME = 'gentle_chime',
  ALERT_SOUND = 'alert_sound',
  CUSTOM = 'custom',
}

export const DEFAULT_NOTIFICATION_TONE = NotificationTone.GENTLE_CHIME;

export const NOTIFICATION_TONE_MAX_FILE_SIZE_MB = 5;

export enum NotificationEventType {
  NEW_REQUEST = 'new_request',
  REQUEST_UPDATED = 'request_updated',
  NEW_BOOKING = 'new_booking',
  NEW_MESSAGE_IN_REQUEST = 'new_message_in_request',
  NEW_CHAT_MESSAGE = 'new_chat_message',
}

export enum AccountRole {
  ADMIN = 'admin',
  HOTEL_OWNER = 'hotel_owner',
  GUEST = 'guest',
  HOTEL_STAFF = 'hotel_staff',
}

export const ACCOUNT_ROLES = {
  ADMIN: AccountRole.ADMIN,
  HOTEL_OWNER: AccountRole.HOTEL_OWNER,
  GUEST: AccountRole.GUEST,
  HOTEL_STAFF: AccountRole.HOTEL_STAFF,
} as const;

export const PERMISSIONS: Record<string, Partial<Record<AccountRole, boolean>>> = {
  CAN_CREATE_BOOKING:         { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_MANAGE_STAFF:           { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
  CAN_EDIT_HOTEL:             { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_DELETE_HOTEL:           { [AccountRole.ADMIN]: true },
  CAN_ADD_HOTEL:              { [AccountRole.ADMIN]: true },
  CAN_VIEW_COSTS:             { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
  CAN_SEND_INVITES:           { [AccountRole.ADMIN]: true },
  CAN_MANAGE_RESTAURANT_MENU: { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
};

export const CONCIERGE_SUGGESTIONS: string[] = [
  'I need room service',
  'Request extra towels',
  'Get dining recommendations',
  'Arrange a late checkout',
  'Book a taxi',
  'Wake up call at 7am',
  'Request extra pillows',
  'Restaurant reservation tonight',
  'Laundry pickup',
  'Do not disturb please',
  'Iron and ironing board',
  'Swimming pool timings',
  'Gym schedule',
  'Spa appointment',
  'Airport transfer',
  'Local sightseeing tips',
  'Is breakfast included?',
  'Wi-Fi password please',
  'Baby crib in my room',
  'Ice bucket please',
];

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
      GOOGLE_MAPS_API: this.configService.get<string>('GOOGLE_MAPS_API'),
      TAGLINE: this.configService.get<string>('TAGLINE', 'With you, always'),
      DESCRIPTION: this.configService.get<string>('DESCRIPTION', 'Samantha is your personal concierge and will make your stay a breeze.'),
      X_API_URL: 'https://api.twitter.com',
      LOGO: 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg',
      PROD_FRONTEND_URL: this.configService.get<string>('PROD_FRONTEND_URL', 'https://samantha.flashpact.in'),
      HERO: 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg',

      ACCOUNT_ROLES,
      PERMISSIONS,
      ERROR_CHAT_ONLY_DURING_STAY: 'Chat is only available during your stay (check-in to check-out)',
      TTS_PLAYBACK_RATE: 1.0,
      CONCIERGE_SUGGESTIONS,
      // Platform Configuration
      PLATFORM_DATA_MAPPING: {
        ...PLATFORM_DATA,
        general: {
          LOGIN_OPTIONS,
        },
      },
      NOTIFICATIONS_FETCHED: 'Notifications fetched',
      PREFERENCES_FETCHED: 'Preferences fetched',
      PREFERENCES_UPDATED: 'Preferences updated',
      CONCIERGE_SUGGESTIONS: [
        'I need room service',
        'Request extra towels',
        'Get dining recommendations',
        'Arrange a late checkout',
        'Book a spa treatment',
        'I need a cab',
        'Wake-up call please',
        'What time is breakfast?',
      ],
      AI_ASSISTANT_TITLE: 'AI Assistant',
      AI_ASSISTANT_ROLE_SUGGESTIONS: {
        guest: ['I need room service', 'Request extra towels', 'Arrange a late checkout', 'I need a cab'],
        hotel_staff: ['Show pending requests', 'List today check-ins', 'High priority requests'],
        hotel_owner: ['Hotel stats overview', 'Show pending requests', 'List my hotels'],
        admin: ['Hotel stats overview', 'List my hotels', 'Show costs', 'High priority requests'],
      },
    };
  }

  get private() {
    return {
      // Environment Configuration
      NODE_ENV: this.configService.get<string>('NODE_ENV', 'development'),
      NODE_ENV_AUTOMATION_TEST: 'automation_test',
      BACKEND_PORT: this.configService.get<number>('PORT', 3000),
      FRONTEND_URL: this.configService.get<string>('FRONTEND_URL'),
      BACKEND_URL: this.configService.get<string>('BACKEND_URL'),
      GOOGLE_CLIENT_ID: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      GOOGLE_MAPS_API: this.configService.get<string>('GOOGLE_MAPS_API'),
      GOOGLE_SERVICE_JSON: this.configService.get<string>('GOOGLE_SERVICE_JSON'),
      GOOGLE_MAPS_BASE_URL: 'https://places.googleapis.com/v1/places',
      GOOGLE_MAPS_AUTH_SCOPE: 'https://www.googleapis.com/auth/cloud-platform',
      GOOGLE_MAPS_SEARCH_FIELD_MASK: 'places.id,places.displayName,places.formattedAddress',
      GOOGLE_MAPS_DETAILS_FIELD_MASK: 'id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,rating,location',
      GOOGLE_MAPS_TOKEN_CACHE_KEY: 'google_maps_auth_token',
      GOOGLE_MAPS_TOKEN_CACHE_EXPIRY_MINUTES: 55,
      TAVILY_API_KEY: this.configService.get<string>('TAVILY_API_KEY'),
      TAVILY_BASE_URL: 'https://api.tavily.com/search',
      ONBOARDING_FETCH_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ONBOARDING_FAVICON_BASE_URL: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL',
      AWS_S3_URL_DOMAIN: '.amazonaws.com',
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
      AWS_REGION: this.configService.get<string>('AWS_DEFAULT_REGION') || this.configService.get<string>('AWS_REGION', 'ap-south-1'),
      AWS_S3_BUCKET_NAME: this.configService.get<string>('AWS_BUCKET_NAME') || this.configService.get<string>('AWS_S3_BUCKET_NAME'),
      AWS_S3_PUBLIC_BUCKET_NAME: this.configService.get<string>('AWS_S3_PUBLIC_BUCKET_NAME', 'flashpact-public-bucket'),
      /** Prefix for private bucket keys (e.g. samantha/). All uploads use this prefix. */
      AWS_S3_KEY_PREFIX: this.configService.get<string>('AWS_S3_KEY_PREFIX', 'samantha/'),

      DOC_EXTRACTION_PROMPT: this.configService.get<string>(
        'DOC_EXTRACTION_PROMPT',
        'Extract booking/reservation details from the document: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), guestEmail, guestName, guestPhone, roomNumber, hotelName. Return only the values found; use null for missing.',
      ),
      DOC_VIEW_URL_EXPIRY_SECONDS: parseInt(this.configService.get('DOC_VIEW_URL_EXPIRY_SECONDS') || '3600', 10),
      /** Presigned PUT URL expiry for client-side document upload (seconds). */
      DOC_UPLOAD_URL_EXPIRY_SECONDS: parseInt(this.configService.get('DOC_UPLOAD_URL_EXPIRY_SECONDS') || '900', 10),

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

      // LLM Configuration (models, pricing, STT, TTS)
      LLM: {
        TEXT_MODEL: 'google/gemini-2.5-flash',
        PROVIDER: 'openai',
        CURRENCY: 'usd',
        TEXT_INPUT_PRICE_PER_1K: 0.00015,
        TEXT_OUTPUT_PRICE_PER_1K: 0.0006,
        VOICE_PIPELINE: this.configService.get<string>('VOICE_PIPELINE', 'custom'),
        STT_CONFIG: {
          // Common STT settings across providers
          PROVIDER: this.configService.get<string>('STT_PROVIDER', 'openai'),
          COMMON: {
            SAMPLE_RATE: parseInt(this.configService.get('STT_SAMPLE_RATE') || '24000', 10),
            ENCODING: this.configService.get<string>('STT_ENCODING', 'linear16'),
          },
          DEEPGRAM: {
            API_KEY: this.configService.get<string>('DEEPGRAM_API_KEY'),
            MODEL: this.configService.get<string>('DEEPGRAM_STT_MODEL', 'nova-3'),
            UTTERANCE_END_MS: parseInt(this.configService.get('DEEPGRAM_UTTERANCE_END_MS') || '3000', 10),
          },
          OPENAI: {
            API_KEY: this.configService.get<string>('OPENAI_API_KEY'),
            REALTIME_MODEL: this.configService.get<string>('OPENAI_REALTIME_MODEL', 'gpt-4o-realtime-preview-2024-12-17'),
            TRANSCRIBE_MODEL: this.configService.get<string>('OPENAI_TRANSCRIBE_MODEL', 'gpt-4o-mini-transcribe'),
            VAD_SILENCE_MS: parseInt(this.configService.get('OPENAI_STT_SILENCE_MS') || '800', 10),
            REALTIME_URL: this.configService.get<string>('OPENAI_REALTIME_URL', 'wss://api.openai.com/v1/realtime'),
            VISION_MODEL: this.configService.get<string>('OPENAI_VISION_MODEL', 'gpt-4o'),
          },
        },
        DEEPGRAM_VOICE_AGENT: {
          API_KEY: this.configService.get<string>('DEEPGRAM_API_KEY'),
          URL: 'wss://agent.deepgram.com/v1/agent/converse',
          LISTEN_MODEL: this.configService.get<string>('DEEPGRAM_AGENT_LISTEN_MODEL', 'nova-3'),
          THINK_PROVIDER: this.configService.get<string>('DEEPGRAM_AGENT_THINK_PROVIDER', 'open_ai'),
          THINK_MODEL: this.configService.get<string>('DEEPGRAM_AGENT_THINK_MODEL', 'gpt-4o-mini'),
          THINK_OPENAI_API_KEY: this.configService.get<string>('OPENAI_API_KEY'),
          SPEAK_MODEL: this.configService.get<string>('DEEPGRAM_AGENT_SPEAK_MODEL', 'aura-2-thalia-en'),
        },
        OPENROUTER: {
          API_KEY: this.configService.get<string>('OPENROUTER_API_KEY'),
          BASE_URL: this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        },
        TTS_CONFIG: {
          PROVIDER: this.configService.get<string>('TTS_PROVIDER', 'openai'),
          OPENAI: {
            MODEL: this.configService.get<string>('OPENAI_TTS_MODEL', 'tts-1'),
            VOICE: this.configService.get<string>('OPENAI_TTS_VOICE', 'alloy'),
            CHUNK_MS: parseInt(this.configService.get('OPENAI_TTS_CHUNK_MS') || '100', 10),
            RESPONSE_FORMAT: this.configService.get<string>('OPENAI_TTS_RESPONSE_FORMAT', 'pcm') as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
            /** Default 0: OpenAI TTS PCM stream has no documented leading silence; trimming was cutting the first word. Set via OPENAI_TTS_TRIM_INITIAL_BYTES only if you have evidence of encoder warm-up. */
            TRIM_INITIAL_BYTES: parseInt(this.configService.get('OPENAI_TTS_TRIM_INITIAL_BYTES') || '0', 10),
          },
          HUGGINGFACE: {
            API_KEY: this.configService.get<string>('HUGGINGFACE_API_KEY') ?? this.configService.get<string>('HF_TOKEN'),
            MODEL: this.configService.get<string>('HUGGINGFACE_TTS_MODEL', 'maya-research/maya1'),
            INFERENCE_BASE_URL: this.configService.get<string>('HUGGINGFACE_TTS_INFERENCE_BASE_URL', 'https://router.huggingface.co/hf-inference/models'),
            BASE_URL: this.configService.get<string>('HUGGINGFACE_TTS_BASE_URL'),
          },
          SARVAM: {
            API_KEY: this.configService.get<string>('SARVAM_API_KEY'),
            BASE_URL: this.configService.get<string>('SARVAM_TTS_BASE_URL', 'https://api.sarvam.ai'),
            MODEL: this.configService.get<string>('SARVAM_TTS_MODEL', 'bulbul:v3'),
            SPEAKER: this.configService.get<string>('SARVAM_TTS_SPEAKER', 'shruti'),
            PACE: parseFloat(this.configService.get('SARVAM_TTS_PACE') || '1'),
            SPEECH_SAMPLE_RATE: parseInt(this.configService.get('SARVAM_TTS_SPEECH_SAMPLE_RATE') || '24000', 10),
          },
          LIGHTNING: {
            API_KEY: this.configService.get<string>('LIGHTNING_TTS_API_KEY'),
            BASE_URL: this.configService.get<string>('LIGHTNING_TTS_BASE_URL', 'https://waves-api.smallest.ai'),
            MODEL: this.configService.get<string>('LIGHTNING_TTS_MODEL', 'lightning-v2'),
            VOICE_ID: this.configService.get<string>('LIGHTNING_TTS_VOICE_ID', 'rishika'),
            SAMPLE_RATE: parseInt(this.configService.get('LIGHTNING_TTS_SAMPLE_RATE') || '24000', 10),
            SPEED: parseFloat(this.configService.get('LIGHTNING_TTS_SPEED') || '0.9'),
            OUTPUT_FORMAT: this.configService.get<string>('LIGHTNING_TTS_OUTPUT_FORMAT', 'pcm'),
          },
        },
      },
    };
  }
}
