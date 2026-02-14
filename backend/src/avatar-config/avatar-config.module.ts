import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AvatarConfigController } from './avatar-config.controller';
import { AvatarConfigService } from './avatar-config.service';
import { AvatarConfigRepository } from './avatar-config.repository';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
    imports: [
        DatabaseModule,
        BookingsModule,
    ],
    controllers: [AvatarConfigController],
    providers: [AvatarConfigService, AvatarConfigRepository],
    exports: [AvatarConfigService],
})
export class AvatarConfigModule { }
