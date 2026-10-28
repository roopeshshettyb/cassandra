import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_LENGTH = 6;
export const DEFAULT_CHECK_IN_TIME = '15:00';
export const DEFAULT_CHECK_OUT_TIME = '11:00';
export const DEFAULT_AVAILABILITY_ROOMS = 1;
// Named once, so the reservation limits and what a caller is told about them cannot drift apart.
const RESERVATION_MAX_PARTY_SIZE = 20;
const RESERVATION_PHONE_DIGITS = { MIN: 10, MAX: 13 };

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
export const ROOM_TYPE_IMAGE_MAX_FILE_SIZE_MB = 100;
export const ROOM_TYPE_IMAGES_MAX_COUNT = 8;

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

// Stored as a string column, not a Postgres enum: the app role cannot ALTER TYPE on the managed DB.
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
}

export const DEFAULT_BOOKING_STATUS = BookingStatus.CONFIRMED;

export const BOOKING_STATUSES = [
  { value: BookingStatus.PENDING, label: 'Pending' },
  { value: BookingStatus.CONFIRMED, label: 'Confirmed' },
  { value: BookingStatus.CHECKED_IN, label: 'Checked in' },
  { value: BookingStatus.CHECKED_OUT, label: 'Checked out' },
  { value: BookingStatus.CANCELLED, label: 'Cancelled' },
] as const;

export enum RoomStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
}

export const ROOM_STATUSES = [
  { value: RoomStatus.ACTIVE, label: 'Active' },
  { value: RoomStatus.MAINTENANCE, label: 'Maintenance' },
  { value: RoomStatus.OUT_OF_SERVICE, label: 'Out of service' },
] as const;

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
  CAN_MANAGE_ROOMS:           { [AccountRole.ADMIN]: true, [AccountRole.HOTEL_OWNER]: true, [AccountRole.HOTEL_STAFF]: true },
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
      BOOKING_STATUSES,
      BOOKING_STATUS_CANCELLED: BookingStatus.CANCELLED,
      BOOKING_STATUS_DEFAULT: DEFAULT_BOOKING_STATUS,
      ROOM_STATUSES,
      ROOM_STATUS_DEFAULT: RoomStatus.ACTIVE,
      ROOM_TYPE_IMAGES_MAX_COUNT,
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
      /** The chat's opening message, like the voice line's greeting. Shown on screen, never generated. */
      RESERVATION_CHAT_GREETING: 'Hello, welcome to {HOTEL}! When were you thinking of staying with us?',
      /** Replaced with the property's name in both greetings. */
      RESERVATION_GREETING_HOTEL_TOKEN: '{HOTEL}',
      RESERVATION_SUBTITLE: 'Tell us your dates and we will take it from there',
      /** The chat's language until she has replied in one. */
      RESERVATION_DEFAULT_LANGUAGE: 'en',
      RESERVATION_INPUT_PLACEHOLDER: {
        en: 'Ask about rooms, rates or availability…',
        hi: 'रूम, रेट या उपलब्धता के बारे में पूछें…',
        kn: 'ರೂಮ್, ರೇಟ್ ಅಥವಾ ಲಭ್ಯತೆ ಬಗ್ಗೆ ಕೇಳಿ…',
        ta: 'ரூம், ரேட் அல்லது கிடைப்பது பற்றி கேளுங்கள்…',
        te: 'రూమ్, రేట్ లేదా అందుబాటు గురించి అడగండి…',
      },
      RESERVATION_FATAL_HELP: 'This reservation link may be out of date. Please check the link, or contact the property directly to book.',
      // Public voice reservation
      RESERVATION_VOICE_TITLE: 'Book by voice',
      RESERVATION_VOICE_SUBTITLE: 'Tap the mic and tell us when you would like to stay',
      RESERVATION_VOICE_TAP_TO_SPEAK: 'Tap to speak',
      /** The only other thing a caller needs to know mid-call: tapping ends it. */
      RESERVATION_VOICE_TAP_TO_STOP: 'Tap to stop',
      /**
       * Talking over the agent. The microphone stays open while it speaks, and a
       * caller counts as interrupting once their level has stayed above BARGE_IN_RMS
       * for BARGE_IN_FRAMES frames in a row (about 85ms each) — long enough that a
       * cough or the agent's own echo does not cut it off. The frames just before
       * that are kept and sent, so the "no" that interrupted is still heard.
       */
      RESERVATION_VOICE_BARGE_IN_RMS: 0.03,
      RESERVATION_VOICE_BARGE_IN_FRAMES: 3,
      RESERVATION_VOICE_BARGE_IN_PREROLL_FRAMES: 6,
      RESERVATION_CONNECTING: 'Connecting…',
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
      ERROR_RESERVATION_VOICE_TURN_LIMIT: 'This voice call has reached its limit. Please refresh to start again, or call the property directly.',
      ERROR_RESERVATION_VOICE_RATE_LIMITED: 'Too many voice requests from your connection. Please wait a little and try again.',
      ERROR_RESERVATION_VOICE_TOO_MANY_SESSIONS: 'You already have a voice call open. Please close it before starting another.',
      ERROR_RESERVATION_VOICE_SESSION_EXPIRED: 'This voice call timed out. Please refresh to start a new one.',
      RESERVATION_REPLY_NUDGE: 'You have not said anything to the caller this turn. Reply to them now, in their language, in one or two short sentences: check what they just told you, or ask for the next detail you still need.',
      RESERVATION_TOOL_BUDGET_SPENT: 'You have used your tools enough for this turn. Do not call any more — reply to the caller now.',
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
      RESERVATION_ENQUIRIES_FETCHED: 'Reservation enquiries fetched',
      // Staff-facing view of what the public reservation agent gathered.
      AI_BOOKINGS_TITLE: 'AI Bookings',
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
      AI_BOOKINGS_CONVERSATION_TITLE: 'Conversation',
      AI_BOOKINGS_CONVERSATION_CLOSE: 'Close',
      AI_BOOKINGS_ROLE_GUEST: 'Guest',
      AI_BOOKINGS_ROLE_AGENT: 'Samantha',
      AI_BOOKINGS_ENQUIRY_NTH: 'Enquiry',
      AI_BOOKINGS_ENQUIRY_LATEST: 'Latest enquiry',
      RESERVATION_CONVERSATION_FETCHED: 'Conversation loaded',
      ERROR_RESERVATION_CONVERSATION_NOT_FOUND: 'That conversation does not belong to this property.',
      RESERVATION_SUGGESTIONS: {
        en: ['I want to book a room', 'What are your rates?', 'Do you have availability this weekend?', 'What time is check-in?', 'Is breakfast included?', 'Do you have family rooms?'],
        hi: ['मुझे रूम बुक करना है', 'आपके रेट्स क्या हैं?', 'इस वीकेंड रूम मिलेगा?', 'चेक-इन कितने बजे है?', 'क्या ब्रेकफ़ास्ट शामिल है?', 'फ़ैमिली रूम है?'],
        kn: ['ನನಗೆ ರೂಮ್ ಬುಕ್ ಮಾಡಬೇಕು', 'ನಿಮ್ಮ ರೇಟ್ಸ್ ಎಷ್ಟು?', 'ಈ ವೀಕೆಂಡ್ ರೂಮ್ ಸಿಗುತ್ತಾ?', 'ಚೆಕ್-ಇನ್ ಎಷ್ಟು ಗಂಟೆಗೆ?', 'ಬ್ರೇಕ್‌ಫಾಸ್ಟ್ ಸೇರಿದೆಯಾ?', 'ಫ್ಯಾಮಿಲಿ ರೂಮ್ ಇದೆಯಾ?'],
        ta: ['எனக்கு ரூம் புக் பண்ணணும்', 'உங்க ரேட்ஸ் என்ன?', 'இந்த வீக்கெண்ட் ரூம் கிடைக்குமா?', 'செக்-இன் எத்தனை மணிக்கு?', 'பிரேக்ஃபாஸ்ட் சேர்ந்ததா?', 'ஃபேமிலி ரூம் இருக்கா?'],
        te: ['నాకు రూమ్ బుక్ చేయాలి', 'మీ రేట్స్ ఎంత?', 'ఈ వీకెండ్ రూమ్ దొరుకుతుందా?', 'చెక్-ఇన్ ఎన్ని గంటలకు?', 'బ్రేక్‌ఫాస్ట్ కలిపి ఉందా?', 'ఫ్యామిలీ రూమ్ ఉందా?'],
      },
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
        /**
         * Sarvam's Bulbul, streamed: it sounds native in all five languages and starts
         * speaking in ~0.3s. Measured: ElevenLabs v3 cut Tamil off after two words in
         * 2 of 9 tries. Fixed here rather than read from the environment, so the
         * app-wide TTS provider cannot move the call onto another voice.
         */
        TTS_PROVIDER: 'sarvam',
        /**
         * Silence that ends a caller's turn. Shorter than the concierge's, because a stranger booking a room reads a long pause as "broken".
         * Measured with mid-sentence pauses of 0.6s and 0.9s: 1000ms split none of them, 800ms cut a phone number in half.
         */
        UTTERANCE_END_MS: parseInt(this.configService.get('RESERVATION_VOICE_UTTERANCE_END_MS') || '1000', 10),
        /**
         * Silence that ends a turn when what was said is plainly finished — a yes, a short answer that
         * does not trail off. Anything that might go on still gets UTTERANCE_END_MS. About half of a
         * booking's turns are short confirmations, and a person answers those without waiting a second.
         */
        QUICK_END_MS: 500,
        /**
         * How long a turn that may go on — "my phone number is nine eight two one…" — is held open after
         * that pause, for the caller to carry on. Measured: Sarvam reports speech resuming about 0.4s
         * after it does, so a 0.5s hold cut a phone number read with a 0.9s pause in half; 0.7s does not.
         */
        UNFINISHED_HOLD_MS: 700,
        /** Words an answer may consist of entirely and still be finished, however long: "yes, that is all correct". */
        AFFIRMATION_WORDS: [
          'yes', 'yeah', 'yep', 'yup', 'ya', 'no', 'nope', 'ok', 'okay', 'sure', 'correct', 'right', 'exactly', 'perfect',
          'fine', 'good', 'great', 'alright', 'that', "that's", 'thats', 'is', 'it', "it's", 'all', 'absolutely', 'please',
          'thanks', 'thank', 'you', 'हाँ', 'हां', 'जी', 'नहीं', 'सही', 'है', 'ठीक', 'बिल्कुल', 'ಹೌದು', 'ಸರಿ', 'ಇಲ್ಲ',
          'ஆமாம்', 'சரி', 'இல்லை', 'అవును', 'సరే', 'సరి', 'లేదు',
        ],
        /** Words a finished answer does not end on: "my name is", "the fifth and", "S H R I J I T at". */
        DANGLING_WORDS: [
          'and', 'or', 'but', 'so', 'the', 'a', 'an', 'my', 'our', 'is', 'are', 'to', 'at', 'for', 'from', 'of', 'with',
          'in', 'on', 'um', 'uh', 'er', 'hmm', 'like', 'dot', 'number', 'phone', 'email', 'name', 'then', 'till', 'until',
          'और', 'या', 'लेकिन', 'तो', 'मेरा', 'मेरी', 'मेरे', 'का', 'की', 'के', 'से', 'नाम', 'नंबर', 'ईमेल',
          'ನನ್ನ', 'ಹೆಸರು', 'ನಂಬರ್', 'என்', 'பெயர்', 'நம்பர்', 'నా', 'పేరు', 'నంబర్',
        ],
        /** Digits that read as a phone number still being given: more than a count, fewer than a number. */
        PARTIAL_NUMBER_DIGITS: { MIN: 3, FULL: 10 },
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
        /** A transcript made only of these is noise, not the caller: no turn is taken. */
        NOISE_WORDS: ['a', 'i', 'uh', 'um', 'umm', 'hmm', 'mm', 'ah', 'eh', 'so', 'the', 'and', 'oh'],
        /**
         * Proper nouns to bias the transcript towards, comma separated — a suburb,
         * a room type, a festival package a deployment keeps hearing wrong. Use
         * sparingly: a biased term is heard in background noise too.
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
         * Spoken the moment the caller opens the line, so it does not answer with
         * the silence they have to say "hello?" into.
         *
         * Fixed words rather than a generated opener, because a model round trip
         * would put that silence straight back. Cached alongside the fillers.
         * {HOTEL} is replaced with the property's name.
         */
        GREETING: this.configService.get<string>(
          'RESERVATION_VOICE_GREETING',
          'Hello, thanks for calling {HOTEL}.',
        ),
        /**
         * Said while she thinks, in the language the caller is speaking. Plain
         * acknowledgements, never "let me check": claiming to look something up
         * when nothing is being looked up gives it away. Measured:
         * one English list played "Okay…" before every Kannada answer, so a caller
         * heard her switch language mid-sentence. Only phrases under ~0.9s: the
         * answer plays after the filler, and "சரி சரி…" (2.1s) held it back.
         */
        THINKING_FILLERS: {
          en: ['Okay…', 'Sure…', 'Got it…', 'Mm-hmm…', 'Alright…'],
          hi: ['अच्छा…', 'जी…', 'हाँ जी…', 'ठीक है…', 'एक सेकंड…'],
          kn: ['ಸರಿ…', 'ಆಯ್ತು…'],
          ta: ['சரி…', 'ஆமாங்க…'],
          te: ['సరే…', 'అలాగే…'],
        } as Record<string, string[]>,
        /** Synthesised once per phrase per language, then replayed from memory. */
        FILLER_CACHE_KEY_PREFIX: 'reservation_voice_filler_',
        /**
         * Kept for the life of the process: a fixed, small set. Measured: at 720
         * minutes, stage played no filler on most turns half a day after a deploy,
         * and the caller sat in 1.5–3s of silence; a miss is warmed, not played.
         */
        FILLER_CACHE_MINUTES: Infinity,
        /**
         * Every budget below is env-driven and 0 means unlimited. They are off
         * by default: the agent is being demoed and shared, and a limit that
         * interrupts a real conversation costs more than the spend it saves.
         * Set them above zero to cap an unauthenticated, per-turn-billed surface.
         */
        MAX_TURNS_PER_SESSION: parseInt(this.configService.get('RESERVATION_VOICE_MAX_TURNS_PER_SESSION') || '0', 10),
        MAX_TURNS_PER_IP_PER_WINDOW: parseInt(this.configService.get('RESERVATION_VOICE_MAX_TURNS_PER_IP') || '0', 10),
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
        /** What a reconnecting caller is shown, and what the agent hears of the call on every turn. */
        HISTORY_MESSAGE_LIMIT: 50,
        STAFF_CHAT_LIST_LIMIT: 50,
        /** Notes handed back to the agent when it reads its scratchpad. */
        SCRATCHPAD_NOTE_LIMIT: 50,
        /**
         * Number words in the five languages, for checking a phone number was said.
         * "x2" and "x3" repeat the next digit: "double nine" is 99.
         */
        SPOKEN_DIGITS: {
          zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', double: 'x2', triple: 'x3',
          शून्य: '0', जीरो: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पाँच: '5', पांच: '5', छह: '6', छः: '6', छे: '6', सात: '7', आठ: '8', नौ: '9', डबल: 'x2', ट्रिपल: 'x3',
          ಸೊನ್ನೆ: '0', ಶೂನ್ಯ: '0', ಜೀರೋ: '0', ಒಂದು: '1', ಎರಡು: '2', ಮೂರು: '3', ನಾಲ್ಕು: '4', ಐದು: '5', ಆರು: '6', ಏಳು: '7', ಎಂಟು: '8', ಒಂಬತ್ತು: '9', ಒಂಭತ್ತು: '9', ಡಬಲ್: 'x2', ಟ್ರಿಪಲ್: 'x3',
          பூஜ்ஜியம்: '0', பூஜ்யம்: '0', ஜீரோ: '0', சைபர்: '0', ஒன்று: '1', ஒண்ணு: '1', இரண்டு: '2', ரெண்டு: '2', மூன்று: '3', மூணு: '3', நான்கு: '4', நாலு: '4', ஐந்து: '5', அஞ்சு: '5', ஆறு: '6', ஏழு: '7', எட்டு: '8', ஒன்பது: '9', டபுள்: 'x2', ட்ரிபிள்: 'x3',
          సున్నా: '0', జీరో: '0', ఒకటి: '1', రెండు: '2', మూడు: '3', నాలుగు: '4', ఐదు: '5', ఆరు: '6', ఏడు: '7', ఎనిమిది: '8', తొమ్మిది: '9', డబుల్: 'x2', ట్రిపుల్: 'x3',
        } as Record<string, string>,
        /**
         * The caller is talking about dates, in the five languages: a month, an
         * ordinal, a relative day. A noted date only changes when their message
         * matches this or has a day number — not when they are giving their email.
         */
        DATE_PATTERN: [
          '\\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\b',
          '\\b[a-z]*(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|teenth|tieth)\\b',
          '\\b(today|tonight|tomorrow|weekend|next week|dates?)\\b',
          'जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर|तारीख|परसों|हफ्ते',
          'ಜನವರಿ|ಫೆಬ್ರವರಿ|ಮಾರ್ಚ್|ಏಪ್ರಿಲ್|ಜೂನ್|ಜುಲೈ|ಆಗಸ್ಟ್|ಸೆಪ್ಟೆಂಬರ್|ಅಕ್ಟೋಬರ್|ನವೆಂಬರ್|ಡಿಸೆಂಬರ್|ದಿನಾಂಕ|ನಾಳೆ',
          'ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|ஜூன்|ஜூலை|ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|தேதி|நாளை',
          'జనవరి|ఫిబ్రవరి|మార్చి|ఏప్రిల్|జూన్|జూలై|ఆగస్టు|సెప్టెంబర్|అక్టోబర్|నవంబర్|డిసెంబర్|తేదీ|రేపు',
        ].join('|'),
        /** What the agent calls a property whose name is missing. */
        UNNAMED_HOTEL: 'this property',
        /** Details that must have been noted during the call before an enquiry can be recorded. */
        ENQUIRY_REQUIRED_NOTES: ['checkInDate', 'checkOutDate', 'partySize', 'guestName', 'guestEmail', 'guestPhone'],
        /**
         * What a booking detail must be before it is noted or recorded. Measured (QA,
         * chat 1442): a stay from the tenth to the twelfth of October was recorded on
         * the twenty-third, and a five-digit phone number was read back and accepted.
         */
        MAX_PARTY_SIZE: RESERVATION_MAX_PARTY_SIZE,
        PHONE_DIGITS: RESERVATION_PHONE_DIGITS,
        BOOKING_PROBLEMS: {
          checkInDate: 'the check-in date is before today',
          checkOutDate: 'the check-out date is not after the check-in date',
          partySize: `the number of guests must be from 1 to ${RESERVATION_MAX_PARTY_SIZE}`,
          guestPhone: `a phone number has ${RESERVATION_PHONE_DIGITS.MIN} digits, or more with a country code`,
          guestEmail: 'that is not a working email address',
        } as Record<string, string>,
        /**
         * Output cap for her replies and the note-taker; the longest read-back is ~150
         * tokens. Measured: uncapped, each request asked OpenRouter for 65,536, and
         * with the balance low every request was refused though each needed a few hundred.
         */
        MAX_OUTPUT_TOKENS: 1000,
        /** What the note-taker's tools report. Stored with the call for staff and debugging; no model reads them. */
        NOTE_RESULTS: {
          NOTED: 'Noted.',
          KEPT: 'Not changed, the caller did not just say it:',
          RECORDED: 'Reservation enquiry recorded',
          INCOMPLETE: 'Not recorded, missing:',
          INVALID: 'Not recorded, invalid:',
          ALREADY_RECORDED: 'Not recorded again, unchanged since the last record.',
        },
        /** Details only the caller can give, so they are noted only when the caller has just said them. */
        CALLER_SPOKEN_NOTES: ['guestName', 'guestPhone', 'guestEmail'],
        /** Tool calls one reservation turn may make before it is ended. A full turn needs four. */
        MAX_TOOL_CALLS_PER_TURN: 6,
        /**
         * The stored language follows the script the agent answered in. A Hindi
         * caller spelling an email is still answered in Devanagari, so spelling
         * never moves it; a reply with none of these scripts is English.
         */
        REPLY_SCRIPT_LANGUAGES: [
          { languageCode: 'hi', pattern: '[\u0900-\u097F]' },
          { languageCode: 'kn', pattern: '[\u0C80-\u0CFF]' },
          { languageCode: 'ta', pattern: '[\u0B80-\u0BFF]' },
          { languageCode: 'te', pattern: '[\u0C00-\u0C7F]' },
        ],
        REPLY_LATIN_LANGUAGE: 'en',
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
        /**
         * Writes down the details on a reservation call once the reply has gone out. Replayed over 127
         * real turns, TEXT_MODEL wrote down details nobody gave on 20 of them (a stock phone number, a
         * made-up name, "10 guests" as a phone number); this one on none to one, in about a second. A
         * slower, stronger model got every turn right but kept the next turn waiting for its notes.
         */
        RESERVATION_NOTES: {
          MODEL: 'google/gemini-3.5-flash-lite',
          INPUT_PRICE_PER_1K: 0.0003,
          OUTPUT_PRICE_PER_1K: 0.0025,
        },
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
        /** How many tool round trips one reservation-agent turn may take before it is cut off. */
        AGENT_RECURSION_LIMIT: parseInt(this.configService.get('AGENT_RECURSION_LIMIT') || '16', 10),
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
            /**
             * Left unset, Sarvam was measured handing back an English translation
             * of a Hindi caller ("क्या आप मुझसे हिंदी में बात कर सकते हैं?" arrived as
             * "Can you speak to me in Hindi?"), so the agent never heard Hindi and
             * never switched. 'codemix' keeps Hindi in Devanagari and English —
             * a spelled name, an email — in Latin letters, as it was said.
             */
            MODE: this.configService.get<string>('SARVAM_STT_MODE', 'codemix'),
            /** Sarvam takes 8000 or 16000 and rejects anything else, so the 24kHz pipeline is converted on the way in. */
            SAMPLE_RATE: parseInt(this.configService.get('SARVAM_STT_SAMPLE_RATE') || '16000', 10),
            /** Just under the 8kHz Nyquist of that rate, so nothing folds back into the speech. */
            RESAMPLE_CUTOFF_HZ: 7000,
            EVENT_AUDIO_INPUT: 'audio_input',
            EVENT_AUDIO_END: 'audio_end',
            EVENT_TRANSCRIPT_PARTIAL: 'transcript.partial',
            EVENT_TRANSCRIPT_FINAL: 'transcript.final',
            EVENT_SPEECH_START: 'vad.speech_start',
            EVENT_SPEECH_END: 'vad.speech_end',
            EVENT_ERROR: 'error',
            /**
             * First wait before reopening a connection Sarvam refused or dropped, doubled on each failure
             * up to RECONNECT_MAX_MS. Measured: it refuses a new connection opened soon after five others
             * and accepts again some 20 seconds later.
             */
            RECONNECT_MS: 1000,
            RECONNECT_MAX_MS: 8000,
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
          /**
           * Which upstream serves the model. Left to OpenRouter's default, the same
           * tool-calling request was measured at 3–15s through one Google endpoint
           * and about 1s through another — on a voice call, that is the silence
           * after the caller stops talking. Sorting by latency picks the fast one
           * and still falls back to the others if it is unavailable.
           */
          PROVIDER: { sort: 'latency' },
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
            /** The streaming socket: audio arrives as it is made, not once the whole clip is done. */
            WS_URL: this.configService.get<string>('SARVAM_TTS_WS_URL', 'wss://api.sarvam.ai/text-to-speech/ws'),
            MODEL: this.configService.get<string>('SARVAM_TTS_MODEL', 'bulbul:v3'),
            SPEAKER: this.configService.get<string>('SARVAM_TTS_SPEAKER', 'shruti'),
            PACE: parseFloat(this.configService.get('SARVAM_TTS_PACE') || '1'),
            SPEECH_SAMPLE_RATE: parseInt(this.configService.get('SARVAM_TTS_SPEECH_SAMPLE_RATE') || '24000', 10),
            /** Raw 16-bit PCM, what the browser player takes from every provider. */
            OUTPUT_CODEC: 'linear16',
            /** Used when the chat has no language yet, as on the greeting. */
            DEFAULT_LANGUAGE: 'en-IN',
            /** How long to wait for the first audio before asking once more. Measured: ~0.3s. */
            RESPONSE_TIMEOUT_MS: 3000,
            /** Pause before that second ask: Sarvam refuses connections opened in quick succession. */
            RETRY_DELAY_MS: 500,
            NO_AUDIO_ERROR: 'Sarvam TTS sent no audio in time',
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
