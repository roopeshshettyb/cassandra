import { Sequelize } from 'sequelize-typescript';
import { DatabaseConfig } from './database.config';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger.service';
import { Sample } from '../sample/sample.model';
import { Account } from '../accounts/accounts.model';
import { Notification } from '../notifications/notifications.model';
import { Hotel } from '../hotels/hotels.model';
import { HotelAccount } from '../hotels/hotel-accounts.model';
import { HotelBrand } from '../hotels/brands.model';
import { Booking } from '../bookings/bookings.model';
import { Request } from '../requests/requests.model';
import { Chat } from '../chat/chat.model';
import { Message } from '../messages/message.model';
import { MenuItem } from '../restaurant/restaurant.model';
import { Cost } from '../costs/costs.model';

export const SEQUELIZE_DATABASE_PROVIDER = 'SEQUELIZE_DATABASE_PROVIDER';

export const DATABASE_PROVIDERS = [
  {
    provide: SEQUELIZE_DATABASE_PROVIDER,
    useFactory: async (databaseConfig: DatabaseConfig, configService: ConfigService, logger: LoggerService) => {
      const config = databaseConfig.databaseConfiguration;
      const sequelize = new Sequelize({
        ...config,
        models: [Sample, Account, Notification, Hotel, HotelAccount, HotelBrand, Booking, Chat, Message, Request, MenuItem, Cost],
      });
      await sequelize.authenticate();
      await sequelize.sync();
      // Idempotent column/data migrations. Run each in isolation so a single
      // permission error (e.g. not table owner on a managed DB) doesn't abort boot.
      const migrations = [
        'ALTER TABLE hotel_accounts ADD COLUMN IF NOT EXISTS role VARCHAR(255)',
        'ALTER TABLE hotel_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(255)',
        'ALTER TABLE hotels ADD COLUMN IF NOT EXISTS google_maps_url VARCHAR(512)',
        "ALTER TABLE hotels ADD COLUMN IF NOT EXISTS images JSON DEFAULT '[]'",
        'ALTER TABLE hotels DROP COLUMN IF EXISTS latitude',
        'ALTER TABLE hotels DROP COLUMN IF EXISTS longitude',
        'ALTER TABLE hotels DROP COLUMN IF EXISTS google_place_id',
        'ALTER TABLE menu_items ALTER COLUMN price DROP NOT NULL',
        "UPDATE hotel_accounts SET role = 'hotel_staff' WHERE role IS NULL",
        "UPDATE hotel_accounts SET status = 'active' WHERE status IS NULL",
        "UPDATE hotel_accounts ha SET role = 'hotel_owner' FROM accounts a WHERE ha.account_id = a.id AND a.role = 'hotel_owner'",
      ];
      for (let i = 0; i < migrations.length; i++) {
        try {
          await sequelize.query(migrations[i]);
        } catch (error) {
          logger.error({ error, serviceName: 'Database', actionName: `Migration skipped: ${migrations[i]}` });
        }
      }
      logger.log({
        message: 'Database connection established successfully',
        traces: [{ host: config.host }, { port: config.port }, { database: config.database }],
      });
      return sequelize;
    },
    inject: [DatabaseConfig, ConfigService, LoggerService],
  },
];
