import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { VoiceService } from './voice.service';
import { ChatService } from '../chat/chat.service';
import { AuthService } from '../auth/auth.service';
import WebSocket from 'ws';
import { CASSANDRA_SYSTEM_PROMPT, CASSANDRA_TOOLS } from '../common/cassandra.config';
import { MessageRole, MessageType } from '../common/messages.model';

@WebSocketGateway({ cors: true })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private openaiConnections = new Map<string, WebSocket>();
  private clientSessions = new Map<string, { sessionId: string; accountId: number }>();

  constructor(private configService: ConfigService, private voiceService: VoiceService, private chatService: ChatService, private authService: AuthService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const ws = this.openaiConnections.get(client.id);
    if (ws) {
      ws.close();
      this.openaiConnections.delete(client.id);
    }
    this.clientSessions.delete(client.id);
  }

  @SubscribeMessage('start-session')
  async handleStartSession(client: Socket, data: { token: string; sessionId?: string }) {
    if (!data?.token) {
      client.emit('session-error', { message: 'Token required' });
      return;
    }
    const account = await this.authService.verifyToken(data.token);
    if (!account) {
      client.emit('session-error', { message: 'Invalid or expired token' });
      return;
    }
    const sessionId = data.sessionId ?? `voice-${Date.now()}`;
    const accountId = account.id;

    this.clientSessions.set(client.id, { sessionId, accountId });

    // Get recent context
    const recentMessages = await this.chatService.getRecentMessages(sessionId, 10);
    const history = recentMessages.reverse().map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.openaiConnections.set(client.id, ws);

    ws.on('open', () => {
      console.log('Connected to OpenAI Realtime API');

      // Update session with config and history
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: CASSANDRA_SYSTEM_PROMPT,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: { type: 'server_vad' },
            tools: CASSANDRA_TOOLS,
          },
        }),
      );

      // Inject history into the realtime conversation
      for (const msg of history) {
        ws.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: msg.role,
              content: [{ type: 'input_text', text: msg.content }],
            },
          }),
        );
      }

      client.emit('session-started');
    });

    ws.on('message', async (data: WebSocket.Data) => {
      const message = JSON.parse(data.toString());
      const session = this.clientSessions.get(client.id);
      const sessionId = session?.sessionId;
      const accountId = session?.accountId;

      // Persist User Text (Transcribed by OpenAI)
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        await this.chatService.saveMessage(sessionId, MessageRole.USER, message.transcript, MessageType.VOICE, accountId);
      }

      // Persist Assistant Text (from Voice)
      if (message.type === 'response.audio_transcript.done') {
        await this.chatService.saveMessage(sessionId, MessageRole.ASSISTANT, message.transcript, MessageType.VOICE, accountId);
      }

      // Persist Assistant Text (from Direct Text)
      if (message.type === 'response.text.done') {
        await this.chatService.saveMessage(sessionId, MessageRole.ASSISTANT, message.text, MessageType.TEXT, accountId);
      }

      // Handle function calls with result confirmation
      if (message.type === 'response.function_call_arguments.done') {
        const { name, arguments: args, call_id } = message;
        try {
          const parsedArgs = JSON.parse(args);
          let result;

          switch (name) {
            case 'call_room_service':
              result = await this.voiceService.callRoomService(parsedArgs);
              break;
            case 'request_towels':
              result = await this.voiceService.requestTowels(parsedArgs.quantity);
              break;
            case 'order_food':
              result = await this.voiceService.orderFood(parsedArgs);
              break;
          }

          // Send result back to OpenAI to get a verbal confirmation
          ws.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id,
                output: JSON.stringify(result),
              },
            }),
          );
          ws.send(JSON.stringify({ type: 'response.create' }));
        } catch (error) {
          console.error('Error executing function:', error);
        }
      }

      client.emit('openai-message', message);
    });

    ws.on('error', (e) => client.emit('error', { message: 'Connection error' }));
    ws.on('close', () => client.emit('session-ended'));
  }

  @SubscribeMessage('send-text')
  async handleSendText(client: Socket, data: { text: string }) {
    const ws = this.openaiConnections.get(client.id);
    const session = this.clientSessions.get(client.id);
    const sessionId = session?.sessionId;
    const accountId = session?.accountId;

    if (ws?.readyState === WebSocket.OPEN) {
      // Save User Message
      await this.chatService.saveMessage(sessionId, MessageRole.USER, data.text, MessageType.TEXT, accountId);

      // Send to OpenAI Realtime API as a conversation item
      ws.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: data.text }],
          },
        }),
      );

      // Trigger a response (Cassandra will respond with both text and audio by default)
      ws.send(JSON.stringify({ type: 'response.create' }));
    }
  }

  @SubscribeMessage('audio-data')
  handleAudioData(client: Socket, data: any) {
    const ws = this.openaiConnections.get(client.id);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: data }));
    }
  }

  @SubscribeMessage('commit-audio')
  handleCommitAudio(client: Socket) {
    const ws = this.openaiConnections.get(client.id);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
  }
}
