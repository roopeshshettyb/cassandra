import { Module, forwardRef } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { HotelsModule } from '../hotels/hotels.module';
import { MessagesModule } from '../messages/messages.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { SttModule } from '../stt/stt.module';
import { TtsModule } from '../tts/tts.module';
import { ReservationService } from './reservation.service';
import { ReservationGateway } from './reservation.gateway';
import { ReservationVoiceGateway } from './reservation-voice.gateway';
import { ReservationController } from './reservation.controller';

@Module({
  imports: [forwardRef(() => ChatModule), forwardRef(() => HotelsModule), MessagesModule, CommonModule, AuthModule, SttModule, TtsModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationGateway, ReservationVoiceGateway],
})
export class ReservationModule {}
