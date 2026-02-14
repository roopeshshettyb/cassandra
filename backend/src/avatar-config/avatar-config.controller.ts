import { Controller, Get, Param, Inject, NotFoundException } from '@nestjs/common';
import { BOOKINGS_REPOSITORY } from '../bookings/bookings.repository';
import { Booking } from '../bookings/bookings.model';
import { Hotel } from '../hotels/hotels.model';

@Controller('avatar-config')
export class AvatarConfigController {
    constructor(
        @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    ) { }

    @Get(':bookingId')
    async getAvatarConfig(@Param('bookingId') bookingId: string) {
        // 1. Validate bookingId (simple check if it's a number, though Param is string)
        const id = parseInt(bookingId, 10);
        if (isNaN(id)) {
            throw new NotFoundException('Invalid booking ID');
        }

        // 2. Fetch Booking with Hotel
        const booking = await this.bookingsRepository.findByPk(id, {
            include: [{ model: Hotel, as: 'hotel' }],
        });

        if (!booking || !booking.hotel) {
            throw new NotFoundException('Booking or Hotel not found');
        }

        const config = booking.hotel.avatarConfig;

        // 3. Return config or defaults
        return {
            avatarUrl: config?.avatarUrl || 'https://models.readyplayer.me/698df165d9645a11b117e2fc.glb',
            idleAnimationPath: config?.idleAnimationPath || '/animations/idle.fbx',
            talkingAnimationPath: config?.talkingAnimationPath || '/animations/talking.fbx',
            hiAnimationPath: config?.hiAnimationPath || '/animations/waving.fbx',
            thinkingAnimationPath: config?.thinkingAnimationPath || '/animations/thinking.fbx',
        };
    }
}
