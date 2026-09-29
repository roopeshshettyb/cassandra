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
      ERROR_NO_ACCESS_TO_HOTEL_MENU: 'No access to this hotel menu',
      // Reservation agent — public, unauthenticated
      ERROR_RESERVATION_HOTEL_REQUIRED: 'A hotel is required to start a reservation',
      ERROR_RESERVATION_HOTEL_NOT_FOUND: 'We could not find that property',
      ERROR_RESERVATION_MESSAGE_REQUIRED: 'Type a message to continue',
      ERROR_RESERVATION_RATE_LIMITED: 'You are sending messages too quickly. Please wait a moment and try again.',
      ERROR_RESERVATION_MESSAGE_TOO_LONG: 'That message is too long. Please shorten it and try again.',
      ERROR_RESERVATION_SESSION_ENDED: 'This reservation chat has reached its limit. Please refresh to start a new one, or call the property directly.',
      ERROR_RESERVATION_SETUP_FAILED: 'We could not start the reservation chat. Please try again.',
      ERROR_RESERVATION_MESSAGE_FAILED: 'We could not send that message. Please try again.',
      RESERVATION_TITLE: 'Reserve your stay',
      RESERVATION_SUBTITLE: 'Tell us your dates and we will take it from there',
      RESERVATION_INPUT_PLACEHOLDER: 'Ask about rooms, rates or availability…',
      RESERVATION_FATAL_HELP: 'This reservation link may be out of date. Please check the link, or contact the property directly to book.',
      // Public voice reservation
      RESERVATION_VOICE_TITLE: 'Book by voice',
      RESERVATION_VOICE_SUBTITLE: 'Tap the mic and tell us when you would like to stay',
      RESERVATION_VOICE_TAP_TO_SPEAK: 'Tap to speak',
      /** The only other thing a caller needs to know mid-call: tapping ends it. */
      RESERVATION_VOICE_TAP_TO_STOP: 'Tap to stop',
      RESERVATION_VOICE_CONNECTING: 'Connecting…',
      RESERVATION_VOICE_SWITCH_TO_TEXT: 'Prefer to type?',
      RESERVATION_VOICE_SWITCH_TO_VOICE: 'Prefer to talk?',
      RESERVATION_VOICE_MIC_DENIED: 'We could not access your microphone. Check your browser permissions and try again.',
      /**
       * Extra time allowed for a reply to finish playing before the browser
       * reports done anyway. Read by both voice surfaces: a backgrounded tab
       * stops firing animation frames and a suspended context stops advancing
       * its clock, and neither should strand a call mid-turn.
       */
      VOICE_PLAYBACK_WATCH_GRACE_MS: 2000,
      RESERVATION_VOICE_AMBIENCE_DBFS: -45,
      /**
       * A real hotel-lobby recording, served from the frontend's public folder.
       * Synthesised noise is steady by definition, and a bed that never varies
       * is its own tell — the ear stops hearing a room and starts hearing a
       * hiss. A recording breathes: far-off voices, a door, cutlery.
       *
       * Trimmed and looped in the browser, so any length works.
       *
       * Empty means the recording bundled with the app, which is the normal
       * case: served from the same place as the code that plays it, so the two
       * can never be deployed apart. Set it to an absolute URL for a property
       * that wants its own room — that host needs CORS, since the audio is
       * fetched and decoded rather than handed to an <audio> tag.
       */
      RESERVATION_VOICE_AMBIENCE_URL: this.configService.get<string>('RESERVATION_VOICE_AMBIENCE_URL', ''),
      ERROR_RESERVATION_VOICE_TURN_LIMIT: 'This voice call has reached its limit. Please refresh to start again, or call the property directly.',
      ERROR_RESERVATION_VOICE_RATE_LIMITED: 'Too many voice requests from your connection. Please wait a little and try again.',
      ERROR_RESERVATION_VOICE_TOO_MANY_SESSIONS: 'You already have a voice call open. Please close it before starting another.',
      ERROR_RESERVATION_VOICE_SESSION_EXPIRED: 'This voice call timed out. Please refresh to start a new one.',
      RESERVATION_DATES_NOTED: 'Dates noted',
      ERROR_RESERVATION_VOICE_FAILED: 'We could not process that. Please try speaking again.',
      // A deploy reloads the API and drops every open socket, so a live call can
      // lose its line through no fault of the caller's. Said out loud, because a
      // page that looks ready and answers nothing is worse than a page that
      // admits it is busy.
      RESERVATION_VOICE_RECONNECTING: 'Reconnecting…',
      ERROR_RESERVATION_VOICE_DISCONNECTED: 'The call was disconnected. Please refresh to start a new one.',
      // Per-hotel key the browser keeps its signed reservation session under, so
      // a refresh resumes the same conversation.
      RESERVATION_SESSION_STORAGE_KEY_PREFIX: 'reservation_session_',
      RESERVATION_ENQUIRY_RECORDED: 'Reservation enquiry recorded',
      RESERVATION_ENQUIRIES_FETCHED: 'Reservation enquiries fetched',
      // Staff-facing view of what the public reservation agent gathered.
      AI_BOOKINGS_TITLE: 'AI Bookings',
      AI_BOOKINGS_PROPERTY_LABEL: 'Property',
      AI_BOOKINGS_SHARE_TITLE: 'Share this link to take reservations',
      AI_BOOKINGS_COPY_LINK: 'Copy link',
      AI_BOOKINGS_LINK_COPIED: 'Reservation link copied',
      AI_BOOKINGS_FILTER_BOOKED: 'Booking enquiries',
      AI_BOOKINGS_FILTER_ALL: 'All conversations',
      AI_BOOKINGS_NO_DETAILS: 'Details not captured yet',
      AI_BOOKINGS_NO_MESSAGES: 'No messages in this conversation yet.',
      AI_BOOKINGS_STATUS_CAPTURED: 'ENQUIRY',
      AI_BOOKINGS_STATUS_BROWSING: 'BROWSING',
      AI_BOOKINGS_SHOW_CONVERSATION: 'Read the conversation',
      AI_BOOKINGS_HIDE_CONVERSATION: 'Hide the conversation',
      AI_BOOKINGS_CONVERSATION_TITLE: 'Conversation',
      AI_BOOKINGS_CONVERSATION_CLOSE: 'Close',
      AI_BOOKINGS_ROLE_GUEST: 'Guest',
      AI_BOOKINGS_ROLE_AGENT: 'Samantha',
      AI_BOOKINGS_ENQUIRY_NTH: 'Enquiry',
      AI_BOOKINGS_ENQUIRY_LATEST: 'Latest enquiry',
      RESERVATION_CONVERSATION_FETCHED: 'Conversation loaded',
      ERROR_RESERVATION_CONVERSATION_NOT_FOUND: 'That conversation does not belong to this property.',
      RESERVATION_SUGGESTIONS: [
        'I want to book a room',
        'What are your rates?',
        'Do you have availability this weekend?',
        'What time is check-in?',
        'Is breakfast included?',
        'Do you have family rooms?',
      ],
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

      /**
       * Public voice reservation. A voice turn costs STT seconds + LLM tokens +
       * TTS characters, so every budget here is tighter than the text agent's —
       * an unauthenticated microphone is the most expensive thing we expose.
       */
      RESERVATION_VOICE: {
        /**
         * Provider and turn-taking for the public call only. Empty means "use
         * whatever the rest of the app uses", so the in-stay concierge is never
         * moved by tuning this page.
         */
        STT_PROVIDER: this.configService.get<string>('RESERVATION_VOICE_STT_PROVIDER', ''),
        TTS_PROVIDER: this.configService.get<string>('RESERVATION_VOICE_TTS_PROVIDER', ''),
        /** Silence that ends a caller's turn. Shorter than the concierge's, because a stranger booking a room reads a long pause as "broken". */
        UTTERANCE_END_MS: parseInt(this.configService.get('RESERVATION_VOICE_UTTERANCE_END_MS') || '1200', 10),
        /**
         * English by default, despite 'multi' being the setting that lets one
         * nova-3 session follow a caller switching into Hindi mid sentence.
         *
         * 'multi' was the default until it was measured against the way people
         * actually give an email address here. Three runs each, same audio:
         *
         *   "shrijit at the rate gmail dot com"
         *     en     -> "shrijit at the rate gmail dot com"   3/3
         *     multi  -> ""                                    3/3
         *
         * Not a flaky transcript — the whole utterance, gone, every time. A
         * booking line that silently loses the caller's email is worse than one
         * that cannot follow them into Hindi, so English wins the default and
         * 'multi' is there for a property whose callers need it. It is not a
         * free win either way: 'multi' reads spoken dates more faithfully
         * ("the twenty sixth to the twenty eighth of September" survives intact,
         * where English collapses it to "twenty six-twenty eight september"),
         * and English is the one that keeps a spelled-out name as letters.
         */
        STT_LANGUAGE: this.configService.get<string>('RESERVATION_VOICE_STT_LANGUAGE', 'en'),
        /**
         * Extra proper nouns to bias the transcript towards, comma separated.
         * The property's own name and brand are added automatically; this is
         * for anything else a given deployment keeps hearing wrong — a suburb,
         * a room type, a festival package.
         */
        STT_KEYTERMS: (this.configService.get<string>('RESERVATION_VOICE_STT_KEYTERMS', ''))
          .split(',')
          .map((term) => term.trim())
          .filter((term) => term.length > 0),
        /**
         * How long to wait for the browser to report that it has finished
         * playing the reply before releasing the turn anyway. Only the client
         * knows when sound stopped coming out of the speaker, but a client that
         * crashes or is backgrounded never says so, and the line must not stay
         * busy forever because of it.
         */
        PLAYBACK_DONE_TIMEOUT_MS: parseInt(this.configService.get('RESERVATION_VOICE_PLAYBACK_DONE_TIMEOUT_MS') || '20000', 10),
        /**
         * How long to wait, after the provider signals that speech ended, for
         * the corrected transcript that follows it. Sarvam sends the silence
         * signal first and the finished text after, so answering the signal
         * meant answering a half-finished sentence — a caller reading out a
         * phone number was heard as "my number is". Only a safety net: the turn
         * runs the moment the final arrives, and this covers a provider that
         * never sends one.
         */
        FINAL_TRANSCRIPT_GRACE_MS: parseInt(this.configService.get('RESERVATION_VOICE_FINAL_TRANSCRIPT_GRACE_MS') || '1500', 10),
        TURN_FALLBACK_GRACE_MS: parseInt(this.configService.get('RESERVATION_VOICE_TURN_FALLBACK_GRACE_MS') || '2000', 10),
        /**
         * Every budget below is env-driven and 0 means unlimited. They are off
         * by default: the agent is being demoed and shared, and a limit that
         * interrupts a real conversation costs more than the spend it saves.
         * Set them above zero to cap an unauthenticated, per-turn-billed surface.
         */
        /**
         * Noises to fill the gap between a caller finishing and the answer
         * starting — measured at 2.76s, nearly all of it the model thinking.
         *
         * Every one of these is a plain acknowledgement. The first version of
         * this list had "let me see" and "let me check" in it, and saying you
         * are looking something up when you are not is what made it grate:
         * say hello and be told "let me check" and you can hear the machine.
         * These say only "I heard you, I am still here", which is true on
         * every turn, so it never has to decide whether it has earned one.
         *
         * Long, because repetition is the tell. Six phrases over a ten-turn
         * call means hearing the same one twice, and the ear catches that
         * faster than it catches the silence they replace.
         */
        /**
         * Spoken the moment the caller opens the line, before they say anything.
         *
         * A phone that answers with silence makes you say "hello?" into it to
         * find out whether anything is there. The agent speaks first now, the
         * way a person picking up would.
         *
         * Fixed words rather than a generated opener: it has to arrive instantly,
         * and a model round trip is the one thing that would put the silence
         * back. Synthesised and cached per property alongside the fillers.
         * {HOTEL} is replaced with the property's name.
         */
        GREETING: this.configService.get<string>(
          'RESERVATION_VOICE_GREETING',
          '[warm] Hello, thanks for calling {HOTEL}. When were you thinking of staying with us?',
        ),
        GREETING_HOTEL_TOKEN: '{HOTEL}',
        THINKING_FILLERS: [
          '[thoughtful] Mmm…',
          '[thoughtful] Mm-hmm…',
          '[inhales] Okay…',
          '[thoughtful] Right…',
          '[thoughtful] Sure…',
          '[thoughtful] Got it…',
          '[inhales] Right, okay…',
          '[thoughtful] Ah, okay…',
          '[thoughtful] Mm, right…',
          '[exhales] Okay then…',
          '[thoughtful] Of course…',
          '[thoughtful] Lovely…',
          '[inhales] Mm…',
          '[thoughtful] Yep…',
          '[thoughtful] Okay, sure…',
          '[thoughtful] Right you are…',
          '[inhales] Ah…',
          '[thoughtful] Perfect…',
          '[thoughtful] Understood…',
          '[exhales] Mm-hmm, okay…',
          '[thoughtful] Great…',
          '[thoughtful] Noted…',
          '[inhales] Okay, right…',
          '[thoughtful] Yeah, okay…',
        ],
        /** Synthesised once per phrase per language, then replayed from memory. */
        FILLER_CACHE_KEY_PREFIX: 'reservation_voice_filler_',
        FILLER_CACHE_MINUTES: 720,
        MAX_TURNS_PER_SESSION: parseInt(this.configService.get('RESERVATION_VOICE_MAX_TURNS_PER_SESSION') || '0', 10),
        MAX_TURNS_PER_IP_PER_WINDOW: parseInt(this.configService.get('RESERVATION_VOICE_MAX_TURNS_PER_IP') || '0', 10),
        IP_WINDOW_MINUTES: 60,
        IP_TURN_CACHE_KEY_PREFIX: 'reservation_voice_ip_turns_',
        /**
         * Stops one visitor holding many microphones open, without punishing
         * shared addresses: hotel wifi and mobile carriers NAT plenty of real
         * guests behind a single IP, so this cannot be as tight as it looks.
         */
        MAX_CONCURRENT_SESSIONS_PER_IP: parseInt(this.configService.get('RESERVATION_VOICE_MAX_CONCURRENT_PER_IP') || '0', 10),
        IP_SESSION_CACHE_KEY_PREFIX: 'reservation_voice_ip_sessions_',
        /** Wall-clock cap on a single call, whether or not anyone is speaking. */
        MAX_SESSION_SECONDS: parseInt(this.configService.get('RESERVATION_VOICE_MAX_SESSION_SECONDS') || '0', 10),
        /** Caps STT spend: audio actually streamed, not time connected. */
        MAX_AUDIO_SECONDS_PER_SESSION: parseInt(this.configService.get('RESERVATION_VOICE_MAX_AUDIO_SECONDS') || '0', 10),
        /** 24kHz mono 16-bit PCM — what the browser sends. */
        AUDIO_BYTES_PER_SECOND: 48000,
      },

      // Reservation agent — the one public, unauthenticated LLM surface, so its
      // limits are the only thing standing between a stranger and our token spend.
      RESERVATION: {
        SESSION_TOKEN_TTL_HOURS: 24,
        // Per-connection message budget, and a per-IP budget across connections
        // so reconnecting does not reset the allowance.
        MAX_MESSAGES_PER_SESSION: 40,
        MAX_MESSAGES_PER_IP_PER_WINDOW: 60,
        IP_WINDOW_MINUTES: 60,
        IP_RATE_LIMIT_CACHE_KEY_PREFIX: 'reservation_ip_messages_',
        MAX_MESSAGE_LENGTH: 1000,
        HISTORY_MESSAGE_LIMIT: 50,
        STAFF_CHAT_LIST_LIMIT: 50,
        /** Messages returned when a staff member opens one conversation to read it. */
        STAFF_CONVERSATION_MESSAGE_LIMIT: 200,
        SESSION_TOKEN_SEPARATOR: '.',
        SESSION_TOKEN_HASH_ALGORITHM: 'sha256',
      },

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
        /**
         * What ends a sentence while a reply is streaming, so the agent can
         * start speaking before it has finished writing.
         *
         * The agent answers in the caller's language, and a Hindi or Marathi
         * clause ends with a danda, Urdu with an arabic full stop, CJK with its
         * own stop marks. With only .!? a reply in any of those never split, so
         * nothing reached TTS until the whole answer was written and the line
         * sat silent the entire time.
         */
        SENTENCE_TERMINATORS_LATIN: '.!?',
        SENTENCE_TERMINATORS_OTHER: '\u0964\u0965\u06D4\u3002\uFF01\uFF1F',
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
            /**
             * Empty means "send no language", which is what Deepgram saw before
             * this existed. Set it per surface instead: the in-stay concierge
             * already knows its guest, a public line does not.
             */
            LANGUAGE: this.configService.get<string>('DEEPGRAM_STT_LANGUAGE', ''),
          },
          SARVAM: {
            API_KEY: this.configService.get<string>('SARVAM_API_KEY'),
            WS_URL: this.configService.get<string>('SARVAM_STT_WS_URL', 'wss://api.sarvam.ai/speech-to-text-realtime/ws'),
            /**
             * v4 rather than v3-realtime, because only v4 accepts keyterms, and
             * keyterms are what make a property's own name transcribe correctly.
             */
            MODEL: this.configService.get<string>('SARVAM_STT_MODEL', 'saaras:v4'),
            /**
             * Silence that ends a caller's turn. Sarvam defaults to 1000ms,
             * which is shorter than a person pausing to think: measured, a
             * sentence with an 800ms pause in it arrived as two turns and the
             * agent replied to the first half. At 2000ms it arrives whole.
             */
            SILENCE_DURATION_MS: parseInt(this.configService.get('SARVAM_STT_SILENCE_DURATION_MS') || '2000', 10),
            /**
             * 'auto' is why this provider is here: it reads a caller who answers
             * in Hindi without anyone having configured Hindi, so the surface no
             * longer has to choose one language and lose the other.
             */
            LANGUAGE: this.configService.get<string>('SARVAM_STT_LANGUAGE', 'auto'),
            /** Sarvam takes 8000 or 16000 and rejects anything else, so the 24kHz pipeline is converted on the way in. */
            SAMPLE_RATE: parseInt(this.configService.get('SARVAM_STT_SAMPLE_RATE') || '16000', 10),
            /** Just under the 8kHz Nyquist of that rate, so nothing folds back into the speech. */
            RESAMPLE_CUTOFF_HZ: 7000,
            EVENT_AUDIO_INPUT: 'audio_input',
            EVENT_AUDIO_END: 'audio_end',
            EVENT_TRANSCRIPT_PARTIAL: 'transcript.partial',
            EVENT_TRANSCRIPT_FINAL: 'transcript.final',
            EVENT_SPEECH_END: 'vad.speech_end',
            EVENT_ERROR: 'error',
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
          ELEVENLABS: {
            API_KEY: this.configService.get<string>('ELEVENLABS_API_KEY'),
            BASE_URL: this.configService.get<string>('ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io'),
            /** eleven_v3_conversational is the expressive realtime model (~280ms); eleven_flash_v2_5 is faster (~75ms) but flatter. */
            MODEL: this.configService.get<string>('ELEVENLABS_MODEL', 'eleven_v3_conversational'),
            /** Rachel, ElevenLabs' stock voice — set ELEVENLABS_VOICE_ID to the property's own. */
            VOICE_ID: this.configService.get<string>('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
            /** 24kHz mono 16-bit LE — what the browser player expects (see frontend utils/audio.ts). */
            OUTPUT_FORMAT: this.configService.get<string>('ELEVENLABS_OUTPUT_FORMAT', 'pcm_24000'),
            /**
             * Only Flash/Turbo v2.5 accept `language_code`; eleven_v3 errors when
             * it is sent, so the parameter is gated on the model in use.
             */
            LANGUAGE_ENFORCING_MODELS: ['eleven_flash_v2_5', 'eleven_turbo_v2_5'],
            /**
             * v3 audio tag prepended to every utterance to set Samantha's register,
             * e.g. '[warm]' or '[calm and reassuring]'. Empty leaves delivery to the
             * model. Ignored by non-v3 models, which read tags aloud — keep it empty
             * unless MODEL is a v3 one.
             */
            AUDIO_TAG: this.configService.get<string>('ELEVENLABS_AUDIO_TAG', ''),
            VOICE_SETTINGS: {
              /** Lower is more emotionally variable; higher is steadier and flatter. */
              /**
               * v3's "Natural" setting. Lower is more expressive and also less
               * stable — the same sentence can come back mispronounced or with
               * an odd cadence, and a reply is synthesised a sentence at a time,
               * so every fragment rolls that dice again. Expressiveness is not
               * worth a name read out wrong.
               */
              STABILITY: parseFloat(this.configService.get('ELEVENLABS_STABILITY') || '0.5'),
              SIMILARITY_BOOST: parseFloat(this.configService.get('ELEVENLABS_SIMILARITY_BOOST') || '0.75'),
              /** Style exaggeration. Costs latency above 0, so it stays modest. */
              /** Style exaggeration costs stability and latency both; the delivery cues in the prompt do this job better. */
              STYLE: parseFloat(this.configService.get('ELEVENLABS_STYLE') || '0'),
              USE_SPEAKER_BOOST: this.configService.get<string>('ELEVENLABS_USE_SPEAKER_BOOST', 'true') === 'true',
              SPEED: parseFloat(this.configService.get('ELEVENLABS_SPEED') || '1'),
            },
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
