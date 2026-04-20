import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATIONS_REPOSITORY } from './notifications.repository';
import { Notification, NotificationType } from './notifications.model';
import { CreateNotificationDto, UpdateNotificationDto } from './notifications.dto';
import { FindOptions, CountOptions } from 'sequelize';
import { NotificationFactory } from './notification.factory';
import { Request } from '../requests/requests.model';
import { Booking } from '../bookings/bookings.model';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';

type NotificationEventType = 'NEW_REQUEST' | 'REQUEST_UPDATED' | 'NEW_BOOKING' | 'NEW_MESSAGE';

interface NotifyInput {
  eventType: NotificationEventType;
  hotel: Hotel;
  actor: Account;
  request?: Request;
  booking?: Booking;
  guest?: Account;
  messagePreview?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notificationsRepository: typeof Notification,
    private readonly notificationFactory: NotificationFactory,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notificationData = {
      ...createNotificationDto,
      type: createNotificationDto.type || NotificationType.SYSTEM,
      read: createNotificationDto.read || false,
    };
    return this.notificationsRepository.create<Notification>(notificationData);
  }

  async findAll(filter: FindOptions): Promise<Notification[]> {
    return this.notificationsRepository.findAll(filter);
  }

  async findById(id: number): Promise<Notification | null> {
    return this.notificationsRepository.findByPk(id);
  }

  async findOne(filter: FindOptions): Promise<Notification | null> {
    return this.notificationsRepository.findOne(filter);
  }

  async count(filter: CountOptions): Promise<{ count: number }> {
    const totalCount = await this.notificationsRepository.count(filter);
    return { count: totalCount };
  }

  async update(data: UpdateNotificationDto, filter: any): Promise<[number, Notification[]]> {
    return this.notificationsRepository.update(data, { where: filter, returning: true });
  }

  async findByAccountId(accountId: number): Promise<Notification[]> {
    return this.notificationsRepository.findAll({
      where: {
        accountId,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async notify(input: NotifyInput): Promise<void> {
    if (input.eventType === 'NEW_REQUEST' && input.request) {
      await this.notificationFactory.notifyNewRequest(input.request, input.hotel, input.actor);
      return;
    }
    if (input.eventType === 'REQUEST_UPDATED' && input.request) {
      await this.notificationFactory.notifyRequestUpdated(input.request, input.hotel, input.actor);
      return;
    }
    if (input.eventType === 'NEW_BOOKING' && input.booking && input.guest) {
      await this.notificationFactory.notifyNewBooking(input.booking, input.hotel, input.guest, input.actor);
      return;
    }
    if (input.eventType === 'NEW_MESSAGE' && input.request) {
      await this.notificationFactory.notifyMessageInRequest(input.request, input.hotel, input.actor, input.messagePreview || '');
    }
  }
}
