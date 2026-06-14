import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps, getApp, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { ConstantsService } from '../common/constants/constants.service';

interface FcmPushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Sends notifications directly to FCM v1 via firebase-admin (no Expo relay).
 * Tokens are native device tokens from expo-notifications getDevicePushTokenAsync.
 * Requires FIREBASE_SERVICE_ACCOUNT (raw or base64 JSON) in env; without it,
 * sends are no-ops (logged once) so local/dev without push stays unaffected.
 */
@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);
  private app: App | null = null;
  private initFailed = false;

  constructor(private readonly constantsService: ConstantsService) {}

  private getApp(): App | null {
    if (this.app) return this.app;
    if (this.initFailed) return null;

    const raw = this.constantsService.private.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      this.initFailed = true;
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — FCM push disabled');
      return null;
    }
    try {
      const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const credential = cert(JSON.parse(json) as ServiceAccount);
      this.app = getApps().length ? getApp() : initializeApp({ credential });
      return this.app;
    } catch (err) {
      this.initFailed = true;
      this.logger.error('Failed to init firebase-admin', err instanceof Error ? err.stack : String(err));
      return null;
    }
  }

  // FCM data values must be strings; drop undefined/null and stringify the rest.
  private stringifyData(data?: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value !== undefined && value !== null) out[key] = String(value);
    }
    return out;
  }

  async send(tokens: string[], payload: FcmPushPayload): Promise<void> {
    const valid = (tokens || []).filter((t) => typeof t === 'string' && t.length > 0);
    if (valid.length === 0) return;

    const app = this.getApp();
    if (!app) return;

    try {
      const res = await getMessaging(app).sendEachForMulticast({
        tokens: valid,
        notification: { title: payload.title, body: payload.body },
        data: this.stringifyData(payload.data),
        android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
      });
      if (res.failureCount > 0) {
        res.responses.forEach((r, i) => {
          if (!r.success) this.logger.warn(`FCM send failed for token #${i}: ${r.error?.message}`);
        });
      }
    } catch (err) {
      this.logger.error('FCM push send error', err instanceof Error ? err.stack : String(err));
    }
  }
}
