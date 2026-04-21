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
import { AccountsService } from '../accounts/accounts.service';

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

interface NotifyHandlerConfig {
  canHandle: (input: NotifyInput) => boolean;
  handler: (input: NotifyInput) => Promise<void>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notificationsRepository: typeof Notification,
    private readonly notificationFactory: NotificationFactory,
    private readonly accountsService: AccountsService,
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

  async getPreferences(accountId: number): Promise<{ pushEnabled: boolean; emailEnabled: boolean }> {
    const savedAccount = await this.accountsService.findOne({ where: { id: accountId } });
    const pref = savedAccount?.notificationPreferences;
    return {
      pushEnabled: pref ? pref.push : true,
      emailEnabled: pref ? pref.email : true,
    };
  }

  async updatePreferences(
    accountId: number,
    body: { pushEnabled?: boolean; emailEnabled?: boolean },
  ): Promise<void> {
    const savedAccount = await this.accountsService.findOne({ where: { id: accountId } });
    const currentPreferences = savedAccount?.notificationPreferences || { push: true, email: true };
    const nextPreferences = {
      push: body.pushEnabled !== undefined ? body.pushEnabled : currentPreferences.push,
      email: body.emailEnabled !== undefined ? body.emailEnabled : currentPreferences.email,
    };
    await this.accountsService.update({ notificationPreferences: nextPreferences }, { id: accountId });
  }

  async notify(input: NotifyInput): Promise<void> {
    const config: Record<NotificationEventType, NotifyHandlerConfig> = {
      NEW_REQUEST: {
        canHandle: (data) => !!data.request,
        handler: async (data) => {
          await this.notificationFactory.notifyNewRequest(data.request!, data.hotel, data.actor);
        },
      },
      REQUEST_UPDATED: {
        canHandle: (data) => !!data.request,
        handler: async (data) => {
          await this.notificationFactory.notifyRequestUpdated(data.request!, data.hotel, data.actor);
        },
      },
      NEW_BOOKING: {
        canHandle: (data) => !!data.booking && !!data.guest,
        handler: async (data) => {
          await this.notificationFactory.notifyNewBooking(data.booking!, data.hotel, data.guest!, data.actor);
        },
      },
      NEW_MESSAGE: {
        canHandle: (data) => !!data.request,
        handler: async (data) => {
          await this.notificationFactory.notifyMessageInRequest(data.request!, data.hotel, data.actor, data.messagePreview || '');
        },
      },
    };

    const eventConfig = config[input.eventType];
    if (!eventConfig.canHandle(input)) {
      return;
    }

    await eventConfig.handler(input);
  }
}
