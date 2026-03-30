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
import { Op } from 'sequelize';

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
  async notifyNewRequest(request: Request, hotel: Hotel, actor: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (actor.id === request.guestId || actor.role === AccountRole.GUEST) {
        // Guest created request -> notify all staff
        recipientIds = staffIds;
      } else {
        // Staff created request for guest -> notify guest + all other staff
        recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== actor.id) {
            recipientIds.push(staffIds[i]);
          }
        }
      }

      const notificationData: NotificationPayload = {
        title: 'New Request',
        message: `${request.guestId === actor.id ? actor.name : 'Guest'} has submitted a new ${request.requestType} request`,
        link: `/bookings/${request.bookingId}?tab=requests`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      };

      await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'NEW_REQUEST');
    } catch (error) {
      this.logger.error('Failed to emit new request notification:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Create and emit notification when a request is updated
   */
  async notifyRequestUpdated(request: Request, hotel: Hotel, updatedBy: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (updatedBy.id === request.guestId || updatedBy.role === AccountRole.GUEST) {
        // Guest updated request -> notify all staff
        recipientIds = staffIds;
      } else {
        // Staff updated request -> notify guest + all other staff
        recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== updatedBy.id) {
            recipientIds.push(staffIds[i]);
          }
        }
      }

      const notificationData: NotificationPayload = {
        title: 'Request Updated',
        message: `Your ${request.requestType} request has been updated by ${updatedBy.name}`,
        link: `/bookings/${request.bookingId}?tab=requests`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      };

      await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'REQUEST_UPDATED');
    } catch (error) {
      this.logger.error('Failed to emit request update notification:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Create and emit notification for a new booking
   * Notifies: guest, hotel staff/owner, hotel manager
   */
  async notifyNewBooking(booking: Booking, hotel: Hotel, guest: Account, creator: Account) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(booking.hotelId);
      // Notify guest and all staff, except the one creating the booking
      const allPossibleRecipients = [guest.id, ...staffIds];
      const filteredRecipientIds: number[] = [];
      for (let i = 0; i < allPossibleRecipients.length; i++) {
        if (allPossibleRecipients[i] !== creator.id) {
          filteredRecipientIds.push(allPossibleRecipients[i]);
        }
      }

      const notificationData: NotificationPayload = {
        title: 'New Booking',
        message: `New booking created at ${hotel.name} for ${guest.name}`,
        link: `/bookings/${booking.id}?tab=home`,
        hotelId: booking.hotelId,
        toneUrl: this.getToneUrl(hotel),
      };

      await this.createAndEmitNotifications(filteredRecipientIds, booking.hotelId, notificationData, 'NEW_BOOKING');
    } catch (error) {
      this.logger.error('Failed to emit new booking notification:', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Create and emit notification for new message in request
   * Notifies: opposite party (guest gets notified when staff messages, vice versa)
   */
  async notifyMessageInRequest(request: Request, hotel: Hotel, sender: Account, messagePreview: string) {
    try {
      const staffIds = await this.getHotelStaffAccountIds(request.hotelId);
      let recipientIds: number[] = [];

      if (sender.role === AccountRole.GUEST) {
        // Guest sent message → notify all hotel staff
        recipientIds = staffIds;
      } else {
        // Hotel staff sent message → notify guest + all other staff
        recipientIds.push(request.guestId);
        for (let i = 0; i < staffIds.length; i++) {
          if (staffIds[i] !== sender.id) {
            recipientIds.push(staffIds[i]);
          }
        }
      }

      const notificationData: NotificationPayload = {
        title: 'New Message',
        message: `New message from ${sender.name}: ${messagePreview}`,
        link: `/bookings/${request.bookingId}?tab=requests`,
        hotelId: request.hotelId,
        toneUrl: this.getToneUrl(hotel),
      };

      await this.createAndEmitNotifications(recipientIds, request.hotelId, notificationData, 'NEW_MESSAGE');
    } catch (error) {
      this.logger.error('Failed to emit message notification:', error instanceof Error ? error.stack : String(error));
    }
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
      const createdNotifications: Notification[] = [];
      
      // Use old school for loop as per rule 6
      for (let i = 0; i < uniqueAccountIds.length; i++) {
        const accountId = uniqueAccountIds[i];
        const notification = await this.notificationsRepository.create({
          accountId,
          hotelId,
          title: notificationData.title,
          message: notificationData.message,
          link: notificationData.link,
          toneUrl: notificationData.toneUrl,
          type: this.mapEventTypeToNotificationType(eventType),
          read: false,
        });
        createdNotifications.push(notification);
      }

      // Emit real-time notification via WebSocket individually to include the correct ID
      for (let i = 0; i < createdNotifications.length; i++) {
        const notification = createdNotifications[i];
        this.notificationsGateway.emitToAccount(notification.accountId, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          link: notification.link,
          toneUrl: notification.toneUrl,
          hotelId: hotelId,
          createdAt: notification.createdAt,
        });
      }

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
    // Return tone enum value for frontend to play default tone
    return hotel.notificationTone;
  }

  /**
   * Get account IDs of hotel staff/owner for a given hotel
   */
  private async getHotelStaffAccountIds(hotelId: number): Promise<number[]> {
    try {
      // Join against accounts to restrict to staff/owner roles only.
      // This prevents guests, wrong-role accounts, or stale hotel_accounts rows
      // from receiving notifications they should not see.
      const hotelAccounts = await this.hotelAccountRepository.findAll({
        where: { hotelId },
        attributes: ['accountId'],
        include: [
          {
            model: Account,
            as: 'account',
            attributes: [],
            where: {
              role: { [Op.in]: [AccountRole.HOTEL_STAFF, AccountRole.HOTEL_OWNER] },
            },
            required: true,
          },
        ],
      });

      const accountIds: number[] = [];
      for (let i = 0; i < hotelAccounts.length; i++) {
        accountIds.push(hotelAccounts[i].accountId);
      }
      return accountIds;
    } catch (error) {
      this.logger.error(`Failed to get hotel staff IDs for hotel ${hotelId}:`, error instanceof Error ? error.stack : String(error));
      return [];
    }
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
