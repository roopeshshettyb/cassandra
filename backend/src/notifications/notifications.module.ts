import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationFactory } from './notification.factory';
import { DatabaseModule } from '../database/database.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { HotelAccountsRepository } from '../hotels/hotels.repository';
import { MailerModule } from '../mailer/mailer.module';
import { Account } from '../accounts/accounts.model';

@Module({
  imports: [DatabaseModule, AccountsModule, AuthModule, forwardRef(() => HotelsModule), MailerModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationPreferenceRepository,
    NotificationsService,
    NotificationsGateway,
    NotificationFactory,
    HotelAccountsRepository,
    { provide: 'ACCOUNTS_REPOSITORY', useValue: Account },
  ],
  exports: [NotificationsService, NotificationsGateway, NotificationFactory],
})
export class NotificationsModule {}
