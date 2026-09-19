import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_LENGTH = 6;
export const DEFAULT_CHECK_IN_TIME = '15:00';
export const DEFAULT_CHECK_OUT_TIME = '11:00';

export enum NotificationTone {
  NONE = 'none',
  GENTLE_CHIME = 'gentle_chime',
  ALERT_SOUND = 'alert_sound',
  CUSTOM = 'custom',
}

export const DEFAULT_NOTIFICATION_TONE = NotificationTone.GENTLE_CHIME;

export const NOTIFICATION_TONE_MAX_FILE_SIZE_MB = 5;

export const HOTEL_IMAGE_MAX_FILE_SIZE_MB = 100;
export const HOTEL_IMAGES_MAX_COUNT = 12;

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

export enum HotelMemberRole {
  HOTEL_OWNER = AccountRole.HOTEL_OWNER,
  HOTEL_STAFF = AccountRole.HOTEL_STAFF,
}

export enum HotelMemberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

export const HOTEL_MEMBER_INVITE_TYPE_STAFF = 'staff';

export const ACCOUNT_ROLES = {
  ADMIN: AccountRole.ADMIN,
  HOTEL_OWNER: AccountRole.HOTEL_OWNER,
  GUEST: AccountRole.GUEST,
  HOTEL_STAFF: AccountRole.HOTEL_STAFF,
} as const;

export const HOTEL_MEMBER_ROLES = {
  hotel_owner: {
    key: HotelMemberRole.HOTEL_OWNER,
    label: 'Hotel Owner',
  },
  hotel_staff: {
    key: HotelMemberRole.HOTEL_STAFF,
    label: 'Hotel Staff',
  },
} as const;

export const HOTEL_MEMBER_STATUSES = {
  pending: {
    key: HotelMemberStatus.PENDING,
    label: 'Pending',
  },
  active: {
    key: HotelMemberStatus.ACTIVE,
    label: 'Active',
  },
  disabled: {
    key: HotelMemberStatus.DISABLED,
    label: 'Disabled',
  },
} as const;

export const PERMISSIONS: Record<string, Partial<Record<AccountRole, boolean>>> = {
  CAN_CREATE_BOOKING:         { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_MANAGE_STAFF:           { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
  CAN_EDIT_HOTEL:             { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_DELETE_HOTEL:           { [AccountRole.ADMIN]: true },
  CAN_DELETE_BRAND:           { [AccountRole.ADMIN]: true },
  CAN_ADD_HOTEL:              { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
  CAN_VIEW_COSTS:             { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
  CAN_SEND_INVITES:           { [AccountRole.ADMIN]: true },
  CAN_EDIT_BOOKING:           { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_DELETE_BOOKING:         { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  CAN_MANAGE_RESTAURANT_MENU: { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
  // Creating and editing organisations is platform work, so it stays with admins.
  CAN_MANAGE_ORGANISATIONS:   { [AccountRole.ADMIN]: true },
  // Owners get this too, but scoped: the service narrows them to their own
  // organisation, so the permission grants the screen, not the reach.
  CAN_MANAGE_USERS:           { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true },
};

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
      LOGO: this.configService.get<string>('LOGO', 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg'),
      PROD_FRONTEND_URL: this.configService.get<string>('PROD_FRONTEND_URL', 'https://samantha.flashpact.in'),
      HERO: this.configService.get<string>('HERO', 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg'),
      CALENDLY_DEMO_URL: this.configService.get<string>('CALENDLY_DEMO_URL', 'https://calendly.com/roopesh-flashpact/samantha-demo'),
      LANDING_DEMO_YOUTUBE_ID: this.configService.get<string>('LANDING_DEMO_YOUTUBE_ID', 'I9_GFTV5P2w'),
      PWA_ID: this.configService.get<string>('PWA_ID', '/samantha-concierge'),
      /** Browser/PWA theme colour, injected into index.html and manifest.json at build time. */
      THEME_COLOR: this.configService.get<string>('THEME_COLOR', '#1B2340'),
      /** PWA install icons. Relative names resolve inside frontend/public/, absolute URLs are used as-is. */
      PWA_ICON_192: this.configService.get<string>('PWA_ICON_192', 'logo192.png'),
      PWA_ICON_512: this.configService.get<string>('PWA_ICON_512', 'logo.png'),
      /** PWA install-prompt screenshots. Same resolution rule as the icons above. */
      PWA_SCREENSHOT_NARROW: this.configService.get<string>('PWA_SCREENSHOT_NARROW', 'https://placehold.jp/390x844.png'),
      PWA_SCREENSHOT_WIDE: this.configService.get<string>('PWA_SCREENSHOT_WIDE', 'https://placehold.jp/1920x1080.png'),
      /** Landing page hero video and its poster frame. Bare filenames resolve inside frontend/public/, absolute URLs are used as-is. */
      LANDING_HERO_VIDEO: this.configService.get<string>('LANDING_HERO_VIDEO', 'landingpage-hero.mp4'),
      LANDING_HERO_POSTER: this.configService.get<string>('LANDING_HERO_POSTER', 'landingpage-hero-poster.png'),

      /**
       * Fallback palette and font for the whole app UI. A hotel's own themeConfig overrides
       * these per brand; this is what a deployment looks like before anyone configures one,
       * so a white-labeled tenant is not left in the default gold and navy.
       */
      THEME_DEFAULTS: {
        PRIMARY_COLOR: this.configService.get<string>('THEME_PRIMARY_COLOR', '#D4AF37'),
        SECONDARY_COLOR: this.configService.get<string>('THEME_SECONDARY_COLOR', '#C5A022'),
        NAVY_COLOR: this.configService.get<string>('THEME_NAVY_COLOR', '#1B2340'),
        NAVY_LIGHT_COLOR: this.configService.get<string>('THEME_NAVY_LIGHT_COLOR', '#263462'),
        PRIMARY_HOVER_COLOR: this.configService.get<string>('THEME_PRIMARY_HOVER_COLOR', '#B8860B'),
        BACKGROUND_DEFAULT_LIGHT: this.configService.get<string>('THEME_BACKGROUND_DEFAULT_LIGHT', '#F8F7F4'),
        BACKGROUND_DEFAULT_DARK: this.configService.get<string>('THEME_BACKGROUND_DEFAULT_DARK', '#000000'),
        BACKGROUND_PAPER_LIGHT: this.configService.get<string>('THEME_BACKGROUND_PAPER_LIGHT', '#FFFFFF'),
        BACKGROUND_PAPER_DARK: this.configService.get<string>('THEME_BACKGROUND_PAPER_DARK', '#121212'),
        FONT_FAMILY: this.configService.get<string>(
          'THEME_FONT_FAMILY',
          '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        ),
      },

      ACCOUNT_ROLES,
      HOTEL_MEMBER_ROLES,
      HOTEL_MEMBER_STATUSES,
      PERMISSIONS,
      ERROR_CHAT_ONLY_DURING_STAY: 'Chat is only available during your stay (check-in to check-out)',
      TTS_PLAYBACK_RATE: 1.0,
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
      AI_ASSISTANT_TITLE: 'AI Assistant',
      AI_ASSISTANT_ROLE_SUGGESTIONS: {
        guest: ['I need room service', 'Request extra towels', 'Arrange a late checkout', 'I need a cab', 'Wake-up call please', 'What time is breakfast?'],
        hotel_staff: ['Show pending requests', 'List today check-ins', 'High priority requests', 'Show unresolved complaints', 'List late check-outs', 'Show room service queue'],
        hotel_owner: ['Hotel stats overview', 'Show pending requests', 'List my hotels', "Show today's occupancy", 'Show unresolved complaints', 'Show revenue snapshot'],
        admin: ['Hotel stats overview', 'List my hotels', 'Show costs', 'High priority requests', "Show today's occupancy", 'Show unresolved complaints', 'Show platform health'],
      },
      MENU_CATEGORIES: [
    {
      "value": "appetizer",
      "label": "Appetizer"
    },
    {
      "value": "main_course",
      "label": "Main Course"
    },
    {
      "value": "dessert",
      "label": "Dessert"
    },
    {
      "value": "beverage",
      "label": "Beverage"
    },
    {
      "value": "side",
      "label": "Side"
    },
    {
      "value": "breakfast",
      "label": "Breakfast"
    },
    {
      "value": "lunch",
      "label": "Lunch"
    },
    {
      "value": "dinner",
      "label": "Dinner"
    },
    {
      "value": "snacks",
      "label": "Snacks"
    }
  ],
      INTEGRATIONS: {
        TAB_LABEL: 'Integrations',
        STATUS_REVOKED_LABEL: 'Revoked',
        STATUS_NOT_CONFIGURED_LABEL: 'Not configured',
        GENERATE_BUTTON_LABEL: 'Generate Token',
        ROTATE_BUTTON_LABEL: 'Rotate Token',
        REVOKE_BUTTON_LABEL: 'Revoke Token',
        COPY_TOKEN_BUTTON_LABEL: 'Copy Token',
        COPY_BOOKINGS_URL_BUTTON_LABEL: 'Copy Bookings Webhook URL',
        COPY_REQUESTS_URL_BUTTON_LABEL: 'Copy Requests Webhook URL',
        TOKEN_ONE_TIME_WARNING: 'This token will not be shown again — copy it now and store it securely.',
        REVOKE_CONFIRM_MESSAGE: 'Revoking this token will stop any connected PMS from syncing bookings and requests. Continue?',
        BOOKINGS_WEBHOOK_LABEL: 'Bookings Webhook URL',
        REQUESTS_WEBHOOK_LABEL: 'Requests Webhook URL',
        TOKEN_PREFIX_LABEL: 'Token',
        COPIED_MESSAGE: 'Copied to clipboard',
      },
      ORGANISATIONS: {
        PAGE_EYEBROW: 'Platform',
        // Owners are not platform staff; they only ever see their own row.
        PAGE_EYEBROW_MEMBER: 'Your organisation',
        PAGE_TITLE: 'Organisations',
        TAB_USERS: 'Users',
        TAB_DETAILS: 'Details',
        TAB_DANGER: 'Danger zone',
        DETAILS_CARD_TITLE: 'Organisation details',
        DETAILS_CARD_SUB: 'Shown wherever this organisation is referenced.',
        DANGER_CARD_TITLE: 'Delete organisation',
        DANGER_CARD_SUB: 'Only possible once every member has been moved out.',
        NO_DESCRIPTION_LABEL: 'No description',
        MEMBERS_SUB_LABEL: 'Total',
        ID_LABEL: 'Reference',
        ID_SUB_LABEL: 'Internal',
        OPEN_BUTTON_LABEL: 'Open',
        MANAGE_BUTTON_LABEL: 'Manage',
        SEARCH_PLACEHOLDER: 'Search by name or description…',
        EMPTY_MESSAGE: 'No organisations yet.',
        ADD_BUTTON_LABEL: 'Add Organisation',
        CREATE_TITLE: 'Add Organisation',
        EDIT_TITLE: 'Edit Organisation',
        DELETE_TITLE: 'Delete Organisation',
        DELETE_BUTTON_LABEL: 'Delete',
        DELETE_CONFIRM_PREFIX: 'Delete organisation',
        DELETE_CONFIRM_SUFFIX: 'This cannot be undone.',
        NAME_LABEL: 'Name',
        DESCRIPTION_LABEL: 'Description',
        STATUS_ACTIVE_LABEL: 'Active',
        MEMBERS_LABEL: 'Members',
        NAME_REQUIRED_MESSAGE: 'Name is required',
        USERS: {
          PAGE_TITLE: 'Users',
          SEARCH_PLACEHOLDER: 'Search by name, email or role…',
          EMPTY_MESSAGE: 'No users yet.',
          ADD_BUTTON_LABEL: 'Add User',
          CREATE_TITLE: 'Add User',
          EDIT_TITLE: 'Edit User',
          NAME_LABEL: 'Name',
          EMAIL_LABEL: 'Email',
          ROLE_LABEL: 'Role',
          ORGANISATION_LABEL: 'Organisation',
          NO_ORGANISATION_LABEL: 'No organisation',
          JOINED_LABEL: 'Joined',
          ACTIONS_LABEL: 'Actions',
          SAVE_BUTTON_LABEL: 'Save',
          CANCEL_BUTTON_LABEL: 'Cancel',
          EMAIL_REQUIRED_MESSAGE: 'Email is required',
          ROLE_REQUIRED_MESSAGE: 'Role is required',
          // Guest is deliberately absent: guest accounts come from bookings, so
          // offering it here would create an account the booking flow then can't
          // reconcile. Admin is filtered out for owners at the call site.
          ROLE_OPTIONS: [
            { value: 'admin', label: 'Admin' },
            { value: 'hotel_owner', label: 'Hotel Owner' },
            { value: 'hotel_staff', label: 'Hotel Staff' },
          ],
          // Owners cannot move people between organisations, so rather than
          // showing them a picker that would be rejected, the copy says why.
          ORGANISATION_FIXED_HELP: 'Users you create join your organisation.',
        },
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
      // Firebase service-account JSON (raw or base64) for FCM v1 push. Secret — set in env, never commit.
      FIREBASE_SERVICE_ACCOUNT: this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT'),
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

      ONBOARDING: {
        // Words too generic to identify a brand on their own when token-matching names.
        GENERIC_BRAND_TOKENS: ['hotel', 'hotels', 'group', 'resort', 'resorts', 'inn', 'suites', 'the', 'by', 'member', 'international'],
        // Placeholders {HOTEL_NAME} and {BRAND_LIST} are filled at call time.
        BRAND_MATCH_PROMPT: `A hotel is named "{HOTEL_NAME}".
Here is a list of existing hotel brand names in our database:
{BRAND_LIST}

Does this hotel belong to any of these existing brands?
If more than one could apply (e.g. a sub-brand and its parent group), answer with the MOST SPECIFIC one (the sub-brand, not the parent group).
Answer ONLY with the exact matching name from the list, or "NEW" if none match.`,
      },

      // PMS/webhook integrations. Path values here must match the literal paths on
      // the @Controller/@Post decorators in integrations.webhook.controller.ts —
      // NestJS route decorators need compile-time string literals, so these can't be
      // read from this service at the decorator site; they're used to build the
      // absolute webhook URLs returned to the Hotel Details UI.
      INTEGRATIONS: {
        V1_BOOKINGS_PATH: '/integrations/v1/bookings',
        V1_REQUESTS_PATH: '/integrations/v1/requests',
        TOKEN_BYTE_LENGTH: 32,
        TOKEN_PREFIX_LENGTH: 8,
        TOKEN_HASH_ALGORITHM: 'sha256',
        MSG_TOKEN_GENERATED: 'Integration token generated — copy it now, it will not be shown again',
        MSG_TOKEN_ROTATED: 'Integration token rotated — copy the new token now, it will not be shown again',
        MSG_TOKEN_REVOKED: 'Integration token revoked',
        ERROR_INVALID_TOKEN: 'Invalid or revoked integration token',
        ERROR_UNKNOWN_PROVIDER: 'Unknown integration provider',
        ERROR_BOOKING_NOT_FOUND_FOR_REQUEST: 'bookingExternalId does not match any existing booking for this hotel',
        ERROR_MALFORMED_CANONICAL_BODY: 'Body must be { type: "booking" | "request", data: {...} }',
        MSG_BOOKING_UPSERTED: 'Booking upserted',
        MSG_REQUEST_UPSERTED: 'Request upserted',
        MSG_PROVIDER_WEBHOOK_PROCESSED: 'Provider webhook processed',
        MSG_INTEGRATION_FETCHED: 'Integration fetched',
      },

      // JWT Configuration
      JWT_SECRET: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      JWT_EXPIRY_DAYS: this.configService.get<number>('JWT_EXPIRY_DAYS', 7),

      AGENT_REQUESTS_DEFAULT_LIMIT: 20,
      AGENT_REQUESTS_MAX_LIMIT: 50,
      AGENT_BOOKINGS_DEFAULT_LIMIT: 5,
      AGENT_BOOKINGS_MAX_LIMIT: 50,
      AGENT_BOOKINGS_ACTIVE_ONLY_DEFAULT: true,
      AGENT_HOTELS_DEFAULT_LIMIT: 20,
      AGENT_HOTELS_MAX_LIMIT: 50,

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
        TEXT_MODEL: 'google/gemini-3.1-flash-lite',
        MENU_OCR_MODEL: this.configService.get<string>('MENU_OCR_MODEL', 'google/gemini-2.5-flash-lite'),
        SUMMARY_MODEL: this.configService.get<string>('SUMMARY_MODEL', 'openai/gpt-4o-mini'),
        // Chat/summary/eval all run through OpenRouter (see OPENROUTER below), never OpenAI directly.
        PROVIDER: 'openrouter',
        CURRENCY: 'usd',
        TEXT_INPUT_PRICE_PER_1K: 0.00025,
        TEXT_OUTPUT_PRICE_PER_1K: 0.0015,
        SUMMARY_INPUT_PRICE_PER_1K: 0.00015,
        SUMMARY_OUTPUT_PRICE_PER_1K: 0.0006,
        // gpt-realtime-2 rates (per developers.openai.com/api/docs/models/gpt-realtime-2):
        // realtime sessions bill text AND audio tokens separately, both far above
        // standard chat rates — using TEXT_INPUT/OUTPUT_PRICE_PER_1K here would
        // dramatically undercount voice-call spend.
        REALTIME_PRICING: {
          TEXT_INPUT_PRICE_PER_1K: 0.004,
          TEXT_OUTPUT_PRICE_PER_1K: 0.024,
          AUDIO_INPUT_PRICE_PER_1K: 0.032,
          AUDIO_OUTPUT_PRICE_PER_1K: 0.064,
          CACHED_INPUT_PRICE_PER_1K: 0.0004,
        },
        CONTEXT_SUMMARY: {
          ENABLED: this.configService.get<string>('ENABLE_CONTEXT_SUMMARY', 'false') === 'true',
          TRIGGER_TOKENS: parseInt(this.configService.get('CONTEXT_SUMMARY_TRIGGER_TOKENS') || '4000', 10),
          RAW_TAIL_COUNT: parseInt(this.configService.get('CONTEXT_RAW_TAIL_COUNT') || '5', 10),
          TARGET_WORDS: 300,
          TEMPERATURE: 0.2,
          CACHE_TTL_MINUTES: 3,
          CACHE_KEY_PREFIX: 'chat_context:',
          EMPTY_CONTEXT: '(No messages yet)',
          INSTRUCTIONS: `You are maintaining the long-term memory of a hotel concierge AI chat. Produce one consolidated summary in approximately {TARGET_WORDS} words that captures every important fact the assistant should remember going forward.\n\nIf an existing summary is provided, merge it with the new messages — keep all standing information from the existing summary, then layer the new messages on top. Resolve contradictions in favour of the more recent information.\n\nPreserve:\n- Guest preferences (room, food, language, accessibility)\n- Outstanding and completed requests with their status\n- Confirmed bookings, reservations, special arrangements\n- Key facts (names, dates, room numbers, hotel info, costs)\n- Tool calls that produced lasting outcomes\n\nSkip pleasantries and small talk. Output plain prose only — no markdown, no headers, no bullet points. Refer to the guest as "the guest" and the AI as "the assistant".`,
        },
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
          // Deepgram Voice Agent bills by websocket connection time, not tokens.
          // Default is the pay-as-you-go "Custom - BYO LLM" rate (deepgram.com/pricing) —
          // matches this config: Deepgram STT + Deepgram TTS + our own OpenAI think step.
          // Override if the account is on a different plan/tier.
          PRICE_PER_MINUTE: parseFloat(this.configService.get('DEEPGRAM_VOICE_AGENT_PRICE_PER_MINUTE') || '0.059'),
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
        EVAL: {
          ENABLED: this.configService.get<string>('LLM_EVAL_ENABLED', 'true') === 'true',
          // Chat/voice turns (high-volume).
          SAMPLE_RATE: parseFloat(this.configService.get('LLM_EVAL_SAMPLE_RATE') || '0.1'),
          // Summaries + single-shot tasks (title, extractions, OCR).
          TASK_SAMPLE_RATE: parseFloat(this.configService.get('LLM_EVAL_TASK_SAMPLE_RATE') || '0.3'),
          // Cap on input/output text sent to the task judge (crawl dumps can be huge).
          TASK_INPUT_MAX_CHARS: 8000,
        },
      },
      ACCOUNTS: {
        ERROR_EMAIL_REQUIRED: 'Email is required',
      },
      REQUESTS: {
        MSG_UPDATED: 'Request updated',
        // Status and urgency both decide queue position, so both stay with staff.
        ERROR_STAFF_ONLY_FIELDS: 'Only hotel staff or owner can change request status or priority',
      },
      ORGANISATIONS: {
        MSG_FETCHED: 'Organisations fetched',
        MSG_ONE_FETCHED: 'Organisation fetched',
        MSG_CREATED: 'Organisation created',
        MSG_UPDATED: 'Organisation updated',
        MSG_DELETED: 'Organisation deleted',
        ERROR_NOT_FOUND: 'Organisation not found',
        ERROR_NAME_TAKEN: 'An organisation with that name already exists',
        // Deleting an organisation with people in it would orphan their accounts,
        // and a silently unscoped user is worse than a refused delete.
        ERROR_HAS_MEMBERS: 'Move or remove this organisation\'s users before deleting it',
        USERS: {
          MSG_FETCHED: 'Users fetched',
          MSG_CREATED: 'User created',
          MSG_UPDATED: 'User updated',
          ERROR_NOT_FOUND: 'User not found',
          ERROR_EMAIL_TAKEN: 'An account with that email already exists',
          // An owner may only act inside their own organisation. Both halves matter:
          // they cannot reach another organisation's users, and they cannot hand
          // someone an organisation other than their own.
          ERROR_OUTSIDE_ORGANISATION: 'You can only manage users in your own organisation',
          ERROR_NO_ORGANISATION: 'Your account is not linked to an organisation yet',
          // Tokens issued before organisationId was added to the payload have the
          // key absent rather than null, and last up to JWT_EXPIRY_DAYS. Saying
          // "not linked" to someone who is linked would send them chasing the
          // wrong problem for a week.
          ERROR_STALE_SESSION: 'Please sign out and sign in again to continue',
          // Only an admin may mint another admin. Otherwise an owner could promote
          // themselves out of their own scope, which is the whole boundary gone.
          ERROR_CANNOT_CREATE_ADMIN: 'Only an admin can create an admin user',
          ERROR_ADMIN_HAS_NO_ORGANISATION: 'An admin account cannot belong to an organisation',
          ERROR_ORGANISATION_REQUIRED: 'Hotel owners and staff must belong to an organisation',
          // Guests get their hotel from their booking, so an organisation on a
          // guest would be a second, conflicting source of truth.
          ERROR_GUEST_NOT_MANAGEABLE: 'Guest accounts are created from bookings, not here',
          DEFAULT_LIST_LIMIT: 200,
        },
      },
    };
  }
}
