import { Sequelize } from 'sequelize-typescript';
import { DatabaseConfig } from './database.config';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger.service';
import { Sample } from '../sample/sample.model';
import { Account } from '../accounts/accounts.model';
import { Notification } from '../notifications/notifications.model';
import { Hotel } from '../hotels/hotels.model';
import { HotelAccount } from '../hotels/hotel-accounts.model';
import { Booking } from '../bookings/bookings.model';
import { Request } from '../requests/requests.model';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';
import { MenuItem } from '../restaurant/restaurant.model';
import { Cost } from '../costs/costs.model';
import { NotificationPreference } from '../notifications/notification-preference.model';

export const SEQUELIZE_DATABASE_PROVIDER = 'SEQUELIZE_DATABASE_PROVIDER';

export const DATABASE_PROVIDERS = [
  {
    provide: SEQUELIZE_DATABASE_PROVIDER,
    useFactory: async (databaseConfig: DatabaseConfig, configService: ConfigService, logger: LoggerService) => {
      const config = databaseConfig.databaseConfiguration;
      const sequelize = new Sequelize({
        ...config,
        models: [Sample, Account, Notification, NotificationPreference, Hotel, HotelAccount, Booking, Chat, Message, Request, MenuItem, Cost],
      });
      await sequelize.authenticate();
      await sequelize.sync();
      logger.log({
        message: 'Database connection established successfully',
        traces: [{ host: config.host }, { port: config.port }, { database: config.database }],
      });
      return sequelize;
    },
    inject: [DatabaseConfig, ConfigService, LoggerService],
  },
];
