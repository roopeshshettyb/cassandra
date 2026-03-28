import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATIONS_REPOSITORY } from './notifications.repository';
import { Notification, NotificationType } from './notifications.model';
import { CreateNotificationDto, UpdateNotificationDto } from './notifications.dto';
import { FindOptions, CountOptions } from 'sequelize';

@Injectable()
export class NotificationsService {
  constructor(@Inject(NOTIFICATIONS_REPOSITORY) private readonly notificationsRepository: typeof Notification) {}

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
}
