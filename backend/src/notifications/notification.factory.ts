import { Injectable, Inject, Logger } from '@nestjs/common';
import { NOTIFICATIONS_REPOSITORY } from './notifications.repository';
import { Notification, NotificationType } from './notifications.model';
import { NotificationsGateway } from './notifications.gateway';
import { FcmPushService } from './fcm-push.service';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService, HotelMemberStatus, NotificationTone } from '../common/constants/constants.service';
import { Request } from '../requests/requests.model';
import { Booking } from '../bookings/bookings.model';
import { Hotel } from '../hotels/hotels.model';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { HotelAccount } from '../hotels/hotel-accounts.model';
import { Op } from 'sequelize';

export interface NotificationPayload {
  title: string;
  message: string;
  link?: string;
  hotelId?: number;
  toneUrl?: string;
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  room_service: 'Room Service',
  house_keeping: 'Housekeeping',
  laundry: 'Laundry',
  airport_transfer: 'Airport Transfer',
};

@Injectable()
export class NotificationFactory {
  private readonly logger = new Logger(NotificationFactory.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notificationsRepository: typeof Notification,
    @Inject('ACCOUNTS_REPOSITORY') private readonly accountsRepository: typeof Account,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly fcmPushService: FcmPushService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
    private readonly accountsService: AccountsService,
    @Inject('HOTEL_ACCOUNTS_REPOSITORY') private readonly hotelAccountRepository: typeof HotelAccount,
  ) {}

  async notifyNewRequest(request: Request, hotel: Hotel, actor: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (actor.id === request.guestId || actor.role === AccountRole.GUEST) {
        recipientIds = staffIds;
      } else {
        if (request.guestId !== actor.id) recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== actor.id) recipientIds.push(staffIds[i]);
        }
      }

      await this.createAndEmitNotifications(recipientIds, request.hotelId, {
        title: 'New Request',
        message: `${request.guestId === actor.id ? actor.name : 'Guest'} has submitted a new ${REQUEST_TYPE_LABEL[request.requestType] ?? request.requestType} request`,
        link: `/requests/${request.id}`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      }, 'NEW_REQUEST');
    } catch (error) {
      this.logger.error('Failed to notify new request:', error instanceof Error ? error.stack : String(error));
    }
  }

  async notifyRequestUpdated(request: Request, hotel: Hotel, updatedBy: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (updatedBy.id === request.guestId || updatedBy.role === AccountRole.GUEST) {
        recipientIds = staffIds;
      } else {
        if (request.guestId !== updatedBy.id) recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== updatedBy.id) recipientIds.push(staffIds[i]);
        }
      }

      await this.createAndEmitNotifications(recipientIds, request.hotelId, {
        title: 'Request Updated',
        message: `Your ${REQUEST_TYPE_LABEL[request.requestType] ?? request.requestType} request has been updated by ${updatedBy.name}`,
        link: `/requests/${request.id}`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      }, 'REQUEST_UPDATED');
    } catch (error) {
      this.logger.error('Failed to notify request updated:', error instanceof Error ? error.stack : String(error));
    }
  }

  async notifyNewBooking(booking: Booking, hotel: Hotel, guest: Account, creator: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(booking.hotelId);
      const allPossibleRecipients = [guest.id, ...staffIds];
      const filteredRecipientIds: number[] = [];
      for (let i = 0; i < allPossibleRecipients.length; i++) {
        if (allPossibleRecipients[i] !== creator.id) filteredRecipientIds.push(allPossibleRecipients[i]);
      }

      await this.createAndEmitNotifications(filteredRecipientIds, booking.hotelId, {
        title: 'New Booking',
        message: `New booking created at ${hotel.name} for ${guest.name}`,
        link: `/bookings/${booking.id}?tab=home`,
        hotelId: booking.hotelId,
        toneUrl: this.getToneUrl(hotel),
      }, 'NEW_BOOKING');
    } catch (error) {
      this.logger.error('Failed to notify new booking:', error instanceof Error ? error.stack : String(error));
    }
  }

  async notifyMessageInRequest(request: Request, hotel: Hotel, sender: Account, messagePreview: string) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (sender.role === AccountRole.GUEST) {
        recipientIds = staffIds;
      } else {
        if (request.guestId !== sender.id) recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== sender.id) recipientIds.push(staffIds[i]);
        }
      }

      await this.createAndEmitNotifications(recipientIds, request.hotelId, {
        title: 'New Message',
        message: `New message from ${sender.name}: ${messagePreview}`,
        link: `/requests/${request.id}`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      }, 'NEW_MESSAGE');
    } catch (error) {
      this.logger.error('Failed to notify message in request:', error instanceof Error ? error.stack : String(error));
    }
  }

  private async createAndEmitNotifications(
    accountIds: number[],
    hotelId: number,
    notificationData: NotificationPayload,
    eventType: string,
  ) {
    if (accountIds.length === 0) return;

    const seen = new Set<number>();
    const uniqueAccountIds: number[] = [];
    for (let i = 0; i < accountIds.length; i++) {
      if (!seen.has(accountIds[i])) {
        seen.add(accountIds[i]);
        uniqueAccountIds.push(accountIds[i]);
      }
    }

    const accounts = await this.accountsRepository.findAll({ where: { id: uniqueAccountIds } });
    const accountMap = new Map<number, Account>();
    for (let i = 0; i < accounts.length; i++) {
      accountMap.set(accounts[i].id, accounts[i]);
    }

    const notificationType = this.mapEventTypeToNotificationType(eventType);

    for (let i = 0; i < uniqueAccountIds.length; i++) {
      const accountId = uniqueAccountIds[i];
      const account = accountMap.get(accountId);
      const pref = this.getOrDefaultPreference(account);

      if (pref.pushEnabled) {
        try {
          const notification = await this.notificationsRepository.create({
            accountId,
            hotelId,
            title: notificationData.title,
            message: notificationData.message,
            link: notificationData.link,
            toneUrl: notificationData.toneUrl,
            type: notificationType,
            read: false,
          });
          this.notificationsGateway.emitToAccount(accountId, {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            link: notification.link,
            toneUrl: notification.toneUrl,
            hotelId,
            createdAt: notification.createdAt,
            type: notification.type,
            read: false,
          });
          // Native push to the account's registered mobile devices (FCM v1).
          const tokens = account?.expoPushTokens;
          if (Array.isArray(tokens) && tokens.length > 0) {
            const { deadTokens } = await this.fcmPushService.send(tokens, {
              title: notificationData.title,
              body: notificationData.message,
              data: { link: notificationData.link, notificationId: notification.id, type: notificationType },
            });
            if (deadTokens.length > 0) {
              // Self-heal: drop tokens for uninstalled/rotated devices so we stop retrying them.
              await this.accountsService.removePushTokens(accountId, deadTokens);
            }
          }
        } catch (err) {
          this.logger.error(`Failed to create/emit push notification for account ${accountId}`, err instanceof Error ? err.stack : String(err));
        }
      }

      if (pref.emailEnabled) {
        if (account?.email) {
          try {
            await this.sendNotificationEmail(account, notificationData);
          } catch (err) {
            this.logger.error(`Failed to send email notification to account ${accountId}`, err instanceof Error ? err.stack : String(err));
          }
        }
      }
    }

    this.logger.debug(`Notifications dispatched for hotel ${hotelId}: ${uniqueAccountIds.length} recipients`);
  }

  private getOrDefaultPreference(account?: Account): { pushEnabled: boolean; emailEnabled: boolean } {
    if (!account || !account.notificationPreferences) {
      return { pushEnabled: true, emailEnabled: true };
    }
    return {
      pushEnabled: account.notificationPreferences.push,
      emailEnabled: account.notificationPreferences.email,
    };
  }

  private async sendNotificationEmail(account: Account, data: NotificationPayload): Promise<void> {
    const frontendUrl = this.constantsService.private.FRONTEND_URL ?? '';
    const link = data.link ? `${frontendUrl}${data.link}` : '';
    const ctaHtml = link
      ? `<div style="text-align:center;margin-top:24px"><a href="${link}" style="background:linear-gradient(135deg,#D4AF37,#C5A022);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Details</a></div>`
      : '';
    const contentHtml = `<h2 style="color:#1B2340;margin:0 0 12px">${data.title}</h2><p style="color:#666;font-size:15px;line-height:1.6;margin:0">${data.message}</p>${ctaHtml}`;
    const html = this.mailerService.buildBaseEmailHtml(contentHtml);
    await this.mailerService.sendMail({ to: account.email, subject: data.title, text: data.message, html });
  }

  private getToneUrl(hotel: Hotel): string | undefined {
    if (hotel.notificationTone === NotificationTone.CUSTOM && hotel.customToneUrl) return hotel.customToneUrl;
    return hotel.notificationTone;
  }

  private async getHotelStaffAccountIds(hotelId: number): Promise<number[]> {
    try {
      const hotelAccounts = await this.hotelAccountRepository.findAll({
        where: { hotelId, status: HotelMemberStatus.ACTIVE },
        attributes: ['accountId'],
        include: [{
          model: Account,
          as: 'account',
          attributes: [],
          where: { role: { [Op.in]: [AccountRole.HOTEL_STAFF, AccountRole.HOTEL_OWNER] } },
          required: true,
        }],
      });
      const accountIds: number[] = [];
      for (let i = 0; i < hotelAccounts.length; i++) accountIds.push(hotelAccounts[i].accountId);
      return accountIds;
    } catch (error) {
      this.logger.error(`Failed to get hotel staff IDs for hotel ${hotelId}:`, error instanceof Error ? error.stack : String(error));
      return [];
    }
  }

  private mapEventTypeToNotificationType(eventType: string): NotificationType {
    const mapping: Record<string, NotificationType> = {
      NEW_REQUEST: NotificationType.NEW_REQUEST,
      REQUEST_UPDATED: NotificationType.REQUEST_UPDATED,
      NEW_BOOKING: NotificationType.NEW_BOOKING,
      NEW_MESSAGE: NotificationType.NEW_MESSAGE,
    };
    return mapping[eventType] || NotificationType.SYSTEM;
  }
}
