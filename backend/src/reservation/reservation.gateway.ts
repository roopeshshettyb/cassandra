import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { ConstantsService } from '../common/constants/constants.service';
import { ToolCallRecord } from '../langgraph/langgraph.service';

/**
 * Public, unauthenticated chat for people enquiring about a stay. It reuses the
 * concierge's message pipeline, but the session carries no account, which is
 * what routes it to the reservation prompt and the read-only reservation tools.
 */
@WebSocketGateway({ cors: true, namespace: '/reservation' })
@Injectable()
export class ReservationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReservationGateway.name);

  constructor(
    private readonly reservationService: ReservationService,
    private readonly chatLlmService: ChatLlmService,
    private readonly constantsService: ConstantsService,
  ) {}

  async handleConnection(client: any) {
    if (await this.reservationService.connect(client)) {
      client.messagesSent = 0;
    }
  }

  @SubscribeMessage('message')
  async onMessage(client: any, payload: { content: string }) {
    const strings = this.constantsService.public;
    const limits = this.constantsService.private.RESERVATION;
    if (!client.reservationContext) {
      client.emit('error', { message: strings.ERROR_RESERVATION_SETUP_FAILED });
      return;
    }

    // Typed rather than trusted: a non-string content used to throw out of this
    // handler, which emits nothing and leaves the client waiting forever.
    const raw = payload?.content;
    const content = typeof raw === 'string' ? raw.trim() : '';
    if (!content) {
      client.emit('error', { message: strings.ERROR_RESERVATION_MESSAGE_REQUIRED });
      return;
    }

    if (content.length > limits.MAX_MESSAGE_LENGTH) {
      client.emit('error', { message: strings.ERROR_RESERVATION_MESSAGE_TOO_LONG });
      return;
    }

    const sent = client.messagesSent ?? 0;
    if (limits.MAX_MESSAGES_PER_SESSION > 0 && sent >= limits.MAX_MESSAGES_PER_SESSION) {
      client.emit('error', { message: strings.ERROR_RESERVATION_SESSION_ENDED });
      return;
    }

    // Checked last, and only for a message we would otherwise answer, so a
    // rejected one does not spend the visitor's hourly budget.
    if (!this.reservationService.isWithinIpRateLimit(this.reservationService.clientIp(client))) {
      client.emit('error', { message: strings.ERROR_RESERVATION_RATE_LIMITED });
      return;
    }
    client.messagesSent = sent + 1;

    try {
      const session = await this.reservationService.ensureSession(client);

      await this.chatLlmService.streamUserMessage(session, content, {
        mode: 'text',
        onChunk: async (chunk: string) => {
          client.emit('stream_chunk', { content: chunk });
        },
        onEnd: async (result: { fullContent: string; toolCalls: ToolCallRecord[] }) => {
          client.emit('stream_end', { content: result.fullContent, toolCalls: result.toolCalls });
          await this.reservationService.followReplyLanguage(session, result.fullContent);
        },
      });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: strings.ERROR_RESERVATION_MESSAGE_FAILED });
    }
  }

  handleDisconnect(client: any) {
    delete client.session;
    delete client.reservationContext;
    delete client.messagesSent;
  }
}
