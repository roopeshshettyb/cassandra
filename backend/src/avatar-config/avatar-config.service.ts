import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { AvatarConfig } from './avatar-config.model';
import { BookingsService } from '../bookings/bookings.service';
import { Account } from '../accounts/accounts.model';
import { AVATAR_CONFIG_REPOSITORY } from './avatar-config.repository';

@Injectable()
export class AvatarConfigService {
    constructor(
        @Inject(AVATAR_CONFIG_REPOSITORY)
        private avatarConfigModel: typeof AvatarConfig,
        private bookingsService: BookingsService
    ) { }

    async getConfigForBooking(bookingId: number, account: Account) {
        // 1. Validate access to booking (this ensures user owns/is guest of booking)
        const bookingResult = await this.bookingsService.findByIdForAccount(bookingId, account);
        if (!bookingResult.data) {
            throw new NotFoundException('Booking not found');
        }
        const booking = bookingResult.data as any; // Cast to access properties

        // 2. Find config for the hotel associated with the booking
        const config = await this.avatarConfigModel.findOne({
            where: { hotelId: booking.hotelId },
        });

        // 3. Return config or default fallback
        if (!config) {
            return {
                modelUrl: 'https://models.readyplayer.me/698df165d9645a11b117e2fc.glb', // Default
                animationPaths: {
                    idle: '/animations/idle.fbx',
                    talking: '/animations/talking.fbx',
                    waving: '/animations/waving.fbx',
                    thinking: '/animations/thinking.fbx',
                },
                backgroundColor: '#18181b', // Default Zinc-900
            };
        }

        return config;
    }
}
