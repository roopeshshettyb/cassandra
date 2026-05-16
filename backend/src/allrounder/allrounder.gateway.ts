import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { HotelsService } from '../hotels/hotels.service';
import { SttFactoryService } from '../stt/stt-factory.service';
import type { ISttSession } from '../stt/stt-session.interface';
import { TtsFactoryService } from '../tts/tts-factory.service';
import { AllRounderSession } from './allrounder-session.interface';
import { AllRounderLlmService } from './allrounder-llm.service';
import { AllRounderChatService } from './allrounder-chat.service';
import { parseAllRounderHandshake, authenticateAllRounderAndInit } from './allrounder-auth.helper';
import { ToolCallRecord } from '../langgraph/langgraph.service';
import { AgentCard } from './allrounder-tool.context';

@WebSocketGateway({ cors: true, namespace: '/allrounder' })
@Injectable()
export class AllRounderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AllRounderGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly hotelsService: HotelsService,
    private readonly sttFactory: SttFactoryService,
    private readonly ttsFactory: TtsFactoryService,
    private readonly allRounderLlmService: AllRounderLlmService,
    private readonly allRounderChatService: AllRounderChatService,
  ) {}

  async handleConnection(client: any) {
    const { token } = parseAllRounderHandshake(client);
    if (token) {
      await authenticateAllRounderAndInit(
        client,
        token,
        { authService: this.authService, hotelsService: this.hotelsService, allRounderChatService: this.allRounderChatService },
        async (_session, recentMessages) => {
          client.emit('ready', { messages: recentMessages });
        },
      );
    } else {
      client.sessionPending = true;
      client.emit('auth_required', { message: 'Send auth with token' });
    }
  }

  @SubscribeMessage('auth')
  async onAuth(client: any, payload: { token: string }) {
    if (client.session) {
      client.emit('error', { message: 'Already authenticated' });
      return;
    }
    const token = payload?.token;
    if (!token) {
      client.emit('error', { message: 'auth requires token' });
      return;
    }
    await authenticateAllRounderAndInit(
      client,
      token,
      { authService: this.authService, hotelsService: this.hotelsService, allRounderChatService: this.allRounderChatService },
      async (_session, recentMessages) => {
        client.emit('ready', { messages: recentMessages });
      },
    );
  }

  @SubscribeMessage('message')
  async onMessage(client: any, payload: { content: string }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const content = payload?.content?.trim();
    if (!content) {
      client.emit('error', { message: 'content is required' });
      return;
    }

    try {
      await this.allRounderLlmService.streamUserMessage(session, content, {
        mode: 'text',
        onChunk: async (chunk: string) => {
          client.emit('stream_chunk', { content: chunk });
        },
        onEnd: async (result: { fullContent: string; toolCalls: ToolCallRecord[]; cards: AgentCard[] }) => {
          client.emit('stream_end', { content: result.fullContent, toolCalls: result.toolCalls, cards: result.cards });
        },
      });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Message failed' });
    }
  }

  @SubscribeMessage('new_chat')
  async onNewChat(client: any) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const newChat = await this.allRounderChatService.createForAccount(session.account.id);
      session.chatId = newChat.id;
      client.emit('chat_created', { chatId: newChat.id });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to create new chat' });
    }
  }

  @SubscribeMessage('list_chats')
  async onListChats(client: any) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const chats = await this.allRounderChatService.listForAccount(session.account.id);
      client.emit('chats_list', { chats, activeChatId: session.chatId });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to list chats' });
    }
  }

  @SubscribeMessage('switch_chat')
  async onSwitchChat(client: any, payload: { chatId: number }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) { client.emit('error', { message: 'Not authenticated' }); return; }
    try {
      const chatId = payload?.chatId;
      if (!chatId) { client.emit('error', { message: 'chatId required' }); return; }
      const messages = await this.allRounderChatService.getRecentMessages(chatId, 50);
      session.chatId = chatId;
      client.emit('chat_switched', { chatId, messages });
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'Failed to switch chat' });
    }
  }

  private flushCompletedSentencesToTts(
    state: { sentenceBuffer: string; ttsQueue: Promise<void> },
    client: any,
    provider: { streamToClient: (client: any, text: string, options?: { emitEnd?: boolean }) => Promise<void> },
  ): void {
    const regex = /([.!?])\s+/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const parts: string[] = [];
    while ((match = regex.exec(state.sentenceBuffer)) !== null) {
      const endIndex = match.index + 1;
      const sentence = state.sentenceBuffer.slice(lastIndex, endIndex).trim();
      if (sentence.length > 0) parts.push(sentence);
      lastIndex = regex.lastIndex;
    }
    if (parts.length === 0) return;

    state.sentenceBuffer = state.sentenceBuffer.slice(lastIndex);
    for (const sentence of parts) {
      state.ttsQueue = state.ttsQueue.then(async () => {
        await provider.streamToClient(client, sentence, { emitEnd: false });
      });
      client.emit('voice_text_chunk', { delta: sentence });
    }
  }

  private createSttSession(client: any): ISttSession | null {
    if (client.sttSession) {
      client.sttSession.destroy();
      client.sttSession = null;
    }
    if (client.voiceBusy) return null;

    try {
      const sttSession: ISttSession = this.sttFactory.getFactory().createSession();
      client.sttSession = sttSession;
      let lastFinalTranscript = '';

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        if (isFinal) lastFinalTranscript = text;
      });

      sttSession.onEndOfSpeech(() => {
        sttSession.endInput();
        if (client.sttSession === sttSession) client.sttSession = null;
        sttSession.destroy();
        client.emit('voice_turn_end');

        const session: AllRounderSession | undefined = client.session;
        const textToSpeak = lastFinalTranscript;

        if (!session) {
          client.emit('error', { message: 'Not authenticated' });
          client.emit('voice_ready');
          return;
        }

        if (!textToSpeak) {
          client.emit('voice_ready');
          return;
        }

        client.emit('voice_user_message', { text: textToSpeak });
        client.voiceBusy = true;
        const provider = this.ttsFactory.getProvider();
        const state = { sentenceBuffer: '', ttsQueue: Promise.resolve() as Promise<void> };

        this.allRounderLlmService
          .streamUserMessage(session, textToSpeak, {
            mode: 'voice',
            onChunk: (chunk: string) => {
              if (!chunk) return;
              state.sentenceBuffer += chunk;
              this.flushCompletedSentencesToTts(state, client, provider);
            },
            onEnd: async (result) => {
              if (state.sentenceBuffer.trim().length > 0) {
                await state.ttsQueue;
                await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true });
              } else {
                await state.ttsQueue;
                client.emit('voice_audio_end');
              }
              client.emit('voice_text_end', { text: result.fullContent, cards: result.cards });
            },
          })
          .catch((err: any) => {
            this.logger.error(err);
            client.emit('error', { message: 'Voice response failed' });
            client.emit('voice_ready');
            client.voiceBusy = false;
          });
      });

      return sttSession;
    } catch (err: any) {
      this.logger.error(err);
      client.emit('error', { message: err?.message || 'STT session failed' });
      return null;
    }
  }

  @SubscribeMessage('voice_start')
  onVoiceStart(client: any) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    if (!client.voiceBusy) {
      this.createSttSession(client);
    }
    client.emit('voice_ready');
  }

  @SubscribeMessage('voice_client_chunk')
  onVoiceClientChunk(client: any, payload: { audio?: string }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session || client.voiceBusy) return;

    let sttSession: ISttSession | undefined = client.sttSession;
    if (!sttSession) {
      sttSession = this.createSttSession(client) ?? undefined;
      if (!sttSession) return;
    }

    const base64 = payload?.audio;
    if (!base64 || typeof base64 !== 'string') return;
    sttSession.writeAudio(Buffer.from(base64, 'base64'));
  }

  @SubscribeMessage('voice_send_text')
  async onVoiceSendText(client: any, payload: { text: string }) {
    const session: AllRounderSession | undefined = client.session;
    if (!session) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    const textToSpeak = payload?.text?.trim();
    if (!textToSpeak || client.voiceBusy) return;

    client.voiceBusy = true;
    client.emit('voice_turn_end');
    client.emit('voice_user_message', { text: textToSpeak });

    const provider = this.ttsFactory.getProvider();
    const state = { sentenceBuffer: '', ttsQueue: Promise.resolve() as Promise<void> };

    this.allRounderLlmService
      .streamUserMessage(session, textToSpeak, {
        mode: 'voice',
        onChunk: (chunk: string) => {
          if (!chunk) return;
          state.sentenceBuffer += chunk;
          this.flushCompletedSentencesToTts(state, client, provider);
        },
        onEnd: async (result) => {
          if (state.sentenceBuffer.trim().length > 0) {
            await state.ttsQueue;
            await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true });
          } else {
            await state.ttsQueue;
            client.emit('voice_audio_end');
          }
          client.emit('voice_text_end', { text: result.fullContent, cards: result.cards });
        },
      })
      .catch((err: any) => {
        this.logger.error(err);
        client.emit('error', { message: 'Voice response failed' });
        client.voiceBusy = false;
        client.emit('voice_ready');
      });
  }

  @SubscribeMessage('voice_playback_done')
  onPlaybackDone(client: any) {
    client.voiceBusy = false;
    client.emit('voice_ready');
  }

  @SubscribeMessage('voice_stop')
  onVoiceStop(client: any) {
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      sttSession.endInput();
      sttSession.destroy();
      client.sttSession = null;
    }
  }

  handleDisconnect(client: any) {
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      sttSession.destroy();
      client.sttSession = null;
    }
    delete client.session;
    delete client.sessionPending;
    client.voiceBusy = false;
  }
}
