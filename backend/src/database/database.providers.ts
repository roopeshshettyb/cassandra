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
import { ChatSummary } from '../chat-summary/chat-summary.model';
import { LlmEval } from '../llm-eval/llm-eval.model';
import { Organisation } from '../organisations/organisations.model';
import { HotelIntegration } from '../integrations/hotel-integrations.model';
import { RoomType } from '../rooms/room-types.model';
import { Room } from '../rooms/rooms.model';
import { RoomInventory } from '../rooms/room-inventory.model';
import { BookingRoom } from '../bookings/booking-rooms.model';

export const SEQUELIZE_DATABASE_PROVIDER = 'SEQUELIZE_DATABASE_PROVIDER';

export const DATABASE_PROVIDERS = [
  {
    provide: SEQUELIZE_DATABASE_PROVIDER,
    useFactory: async (databaseConfig: DatabaseConfig, configService: ConfigService, logger: LoggerService) => {
      const config = databaseConfig.databaseConfiguration;
      const sequelize = new Sequelize({
        ...config,
        models: [Sample, Account, Notification, Hotel, HotelAccount, HotelBrand, Booking, Chat, Message, Request, MenuItem, Cost, ChatSummary, LlmEval, HotelIntegration, Organisation, RoomType, Room, RoomInventory, BookingRoom],
      });
      await sequelize.authenticate();
      try {
        await sequelize.sync();
      } catch (error) {
        // Sequelize's enum sync (ALTER TYPE ... ADD VALUE) requires type ownership.
        // On this managed DB the app role doesn't own pre-existing enum types, so
        // tolerate that specific failure rather than aborting boot; anything else
        // (e.g. a genuine schema bug) should still fail loudly.
        if (!/must be owner of/i.test((error as Error).message)) {
          throw error;
        }
        logger.error({ error, serviceName: 'Database', actionName: 'sequelize.sync (enum permission)' });
      }
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
        "ALTER TYPE enum_costs_type ADD VALUE IF NOT EXISTS 'llm_eval'",
        "ALTER TYPE enum_llm_evals_dimension ADD VALUE IF NOT EXISTS 'summary_accuracy'",
        "ALTER TYPE enum_llm_evals_dimension ADD VALUE IF NOT EXISTS 'onboarding_extraction'",
        "ALTER TYPE enum_llm_evals_dimension ADD VALUE IF NOT EXISTS 'document_extraction'",
        "ALTER TYPE enum_llm_evals_dimension ADD VALUE IF NOT EXISTS 'menu_ocr'",
        "ALTER TYPE enum_llm_evals_dimension ADD VALUE IF NOT EXISTS 'chat_title'",
        'ALTER TABLE llm_evals ALTER COLUMN chat_id DROP NOT NULL',
        'ALTER TABLE llm_evals ALTER COLUMN message_id DROP NOT NULL',
        "UPDATE hotel_accounts SET role = 'hotel_staff' WHERE role IS NULL",
        "UPDATE hotel_accounts SET status = 'active' WHERE status IS NULL",
        "UPDATE hotel_accounts ha SET role = 'hotel_owner' FROM accounts a WHERE ha.account_id = a.id AND a.role = 'hotel_owner'",
        'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)',
        'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(255)',
        "UPDATE bookings SET status = 'confirmed' WHERE status IS NULL",
        // room_types can predate its images and perks columns, and sync() creates
        // missing tables but never adds columns to existing ones.
        "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS images JSON DEFAULT '[]'",
        "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS perks JSON DEFAULT '[]'",
        'ALTER TABLE requests ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)',
        'CREATE UNIQUE INDEX IF NOT EXISTS bookings_hotel_id_external_id_unique ON bookings (hotel_id, external_id) WHERE external_id IS NOT NULL',
        'CREATE UNIQUE INDEX IF NOT EXISTS requests_hotel_id_external_id_unique ON requests (hotel_id, external_id) WHERE external_id IS NOT NULL',
        // Reservation chats are anonymous (no account) and hotel-scoped rather
        // than booking-scoped, so account_id has to give up NOT NULL.
        'ALTER TABLE chats ALTER COLUMN account_id DROP NOT NULL',
        'ALTER TABLE chats ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES hotels(id)',
        'ALTER TABLE messages ADD COLUMN IF NOT EXISTS raw_content TEXT',
        "ALTER TYPE enum_chats_chat_type ADD VALUE IF NOT EXISTS 'reservation'",
        // Backs RoomsService.ensureRoomNumberFree, which a concurrent create can slip
        // past. Soft-deleted rooms are left out, as they are by that check.
        'CREATE UNIQUE INDEX IF NOT EXISTS rooms_hotel_id_room_number_unique ON rooms (hotel_id, room_number) WHERE deleted_at IS NULL',
        // Skipping this locks everyone out — the model declares the column, so
        // every account query selects it. Check information_schema, not the log
        // above: ownership is tested before IF NOT EXISTS, so it errors regardless.
        'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)',
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
