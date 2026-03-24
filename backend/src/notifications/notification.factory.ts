import { Injectable, Inject, Logger } from '@nestjs/common';
import { NOTIFICATIONS_REPOSITORY } from './notifications.repository';
import { Notification, NotificationType } from './notifications.model';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEventType, NotificationTone } from '../common/constants/constants.service';
import { Request } from '../requests/requests.model';
import { Booking } from '../bookings/bookings.model';
import { Hotel } from '../hotels/hotels.model';
import { Account, AccountRole } from '../accounts/accounts.model';
import { HotelAccount } from '../hotels/hotel-accounts.model';

export interface NotificationPayload {
  title: string;
  message: string;
  link?: string;
  hotelId?: number;
  toneUrl?: string;
}

@Injectable()
export class NotificationFactory {
  private readonly logger = new Logger(NotificationFactory.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notificationsRepository: typeof Notification,
    private readonly notificationsGateway: NotificationsGateway,
    @Inject('HOTEL_ACCOUNTS_REPOSITORY') private readonly hotelAccountRepository: typeof HotelAccount,
  ) {}

  /**
   * Create and emit notification for a new request
   * Notifies: hotel staff/owner of the hotel, hotel manager
   */
  async notifyNewRequest(request: Request, hotel: Hotel, guest: Account) {
    const recipientIds = await this.getHotelStaffAccountIds(request.hotelId);
    const notificationData: NotificationPayload = {
      title: 'New Request',
      message: `${guest.name} has submitted a new ${request.requestType} request`,
      link: '/requests',
      hotelId: request.hotelId,
      toneUrl: this.getToneUrl(hotel),
    };

    await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'NEW_REQUEST');
  }

  /**
   * Create and emit notification when a request is updated
   */
  async notifyRequestUpdated(request: Request, hotel: Hotel, updatedBy: Account) {
    const recipientIds = await this.getRequestParticipantIds(request);
    const notificationData: NotificationPayload = {
      title: 'Request Updated',
      message: `Your ${request.requestType} request has been updated by ${updatedBy.name}`,
      link: '/requests',
      hotelId: request.hotelId,
      toneUrl: this.getToneUrl(hotel),
    };

    await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'REQUEST_UPDATED');
  }

  /**
   * Create and emit notification for a new booking
   * Notifies: guest, hotel staff/owner, hotel manager
   */
  async notifyNewBooking(booking: Booking, hotel: Hotel, guest: Account) {
    const staffIds = await this.getHotelStaffAccountIds(booking.hotelId);
    const recipientIds = [guest.id, ...staffIds];

    const notificationData: NotificationPayload = {
      title: 'New Booking',
      message: `New booking created at ${hotel.name} for ${guest.name}`,
      link: `/bookings/${booking.id}`,
      hotelId: booking.hotelId,
      toneUrl: this.getToneUrl(hotel),
    };

    await this.createAndEmitNotifications(recipientIds, booking.hotelId, notificationData, 'NEW_BOOKING');
  }

  /**
   * Create and emit notification for new message in request
   * Notifies: opposite party (guest gets notified when staff messages, vice versa)
   */
  async notifyMessageInRequest(request: Request, hotel: Hotel, sender: Account, messagePreview: string) {
    let recipientIds: number[] = [];

    if (sender.role === AccountRole.GUEST) {
      // Guest sent message → notify hotel staff
      recipientIds = await this.getHotelStaffAccountIds(request.hotelId);
    } else {
      // Hotel staff sent message → notify guest
      recipientIds = [request.guestId];
    }

    const notificationData: NotificationPayload = {
      title: 'New Message',
      message: `New message from ${sender.name}: ${messagePreview}`,
      link: '/requests',
      hotelId: request.hotelId,
      toneUrl: this.getToneUrl(hotel),
    };

    await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'NEW_MESSAGE');
  }

  /**
   * Create notification records in DB and emit via WebSocket
   */
  private async createAndEmitNotifications(
    accountIds: number[],
    hotelId: number,
    notificationData: NotificationPayload,
    eventType: string,
  ) {
    if (accountIds.length === 0) return;

    // Remove duplicates
    const uniqueAccountIds = Array.from(new Set(accountIds));

    try {
      // Create notification records for each recipient
      await Promise.all(
        uniqueAccountIds.map((accountId) =>
          this.notificationsRepository.create({
            accountId,
            hotelId,
            title: notificationData.title,
            message: notificationData.message,
            link: notificationData.link,
            toneUrl: notificationData.toneUrl,
            type: this.mapEventTypeToNotificationType(eventType),
            read: false,
          }),
        ),
      );

      // Emit real-time notification via WebSocket
      this.notificationsGateway.emitToAccounts(uniqueAccountIds, {
        title: notificationData.title,
        message: notificationData.message,
        link: notificationData.link,
        toneUrl: notificationData.toneUrl,
        createdAt: new Date().toISOString(),
      });

      this.logger.debug(
        `Notifications created and emitted for hotel ${hotelId}: ${uniqueAccountIds.length} recipients`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create/emit notifications for hotel ${hotelId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get tone URL based on hotel notification settings
   * Returns either custom tone S3 URL or the tone enum value (which is a string)
   */
  private getToneUrl(hotel: Hotel): string | undefined {
    if (hotel.notificationTone === NotificationTone.CUSTOM && hotel.customToneUrl) {
      return hotel.customToneUrl;
    }
    // Return tone enum value (which is a string) for frontend to play default tone
    return hotel.notificationTone as string | undefined;
  }

  /**
   * Get account IDs of hotel staff/owner for a given hotel
   */
  private async getHotelStaffAccountIds(hotelId: number): Promise<number[]> {
    try {
      const hotelAccounts = await this.hotelAccountRepository.findAll({
        where: { hotelId },
        attributes: ['accountId'],
      });
      return hotelAccounts.map((ha) => ha.accountId);
    } catch (error) {
      console.error(`Failed to get hotel staff IDs for hotel ${hotelId}:`, error.message);
      return [];
    }
  }

  /**
   * Get IDs of all participants in a request (guest + staff who messaged)
   */
  private async getRequestParticipantIds(request: Request): Promise<number[]> {
    const participantIds = [request.guestId];
    // TODO: Query staff members who have added messages to this request
    return participantIds;
  }

  /**
   * Map event type to NotificationType enum value
   */
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
