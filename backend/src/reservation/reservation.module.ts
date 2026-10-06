import { CostsModule } from '../costs/costs.module';
import { ChatContextModule } from '../chat-context/chat-context.module';
import { Module, forwardRef } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { HotelsModule } from '../hotels/hotels.module';
import { MessagesModule } from '../messages/messages.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { ReservationService } from './reservation.service';
import { ReservationGateway } from './reservation.gateway';
import { ReservationVoiceGateway } from './reservation-voice.gateway';
import { ReservationController } from './reservation.controller';

@Module({
  imports: [forwardRef(() => ChatModule), forwardRef(() => HotelsModule), MessagesModule, CommonModule, AuthModule, CostsModule, ChatContextModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationGateway, ReservationVoiceGateway],
  exports: [ReservationService],
})
export class ReservationModule {}
