import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { OpenAIRealtimeWebSocket } from 'openai/beta/realtime/websocket';
import WebSocket from 'ws';
import type { ISttSession, SttSessionFactory } from './stt-session.interface';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

const globalWithWebSocket = globalThis as unknown as { WebSocket?: unknown };
if (!globalWithWebSocket.WebSocket) {
  globalWithWebSocket.WebSocket = WebSocket;
}

@Injectable()
export class OpenaiSttService implements SttSessionFactory {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  createSession(): ISttSession {
    const sttConfig = this.constantsService.private.LLM.STT_CONFIG;
    const openaiConfig = sttConfig.OPENAI;
    const apiKey = openaiConfig.API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for STT provider openai');
    }
    const client = new OpenAI({ apiKey });

    let socket: OpenAIRealtimeWebSocket | null = null;
    let ready = false;
    let destroyed = false;
    let transcriptCb: ((text: string, isFinal?: boolean) => void) | null = null;
    let endOfSpeechCb: (() => void) | null = null;
    const pendingAudio: string[] = [];

    const logger = this.logger;

    (async () => {
      try {
        socket = await OpenAIRealtimeWebSocket.create(client, {
          model: openaiConfig.REALTIME_MODEL,
        });

        socket.on('session.created', () => {
          if (!socket) return;
          // Configure session for transcription + server VAD turn detection.
          socket.send({
            type: 'session.update',
            session: {
              input_audio_format: 'pcm16',
              input_audio_transcription: {
                model: openaiConfig.TRANSCRIBE_MODEL,
              },
              turn_detection: {
                type: 'server_vad',
                silence_duration_ms: openaiConfig.VAD_SILENCE_MS,
              },
              modalities: ['text'],
            },
          });
        });

        socket.on('session.updated', () => {
          ready = true;
          for (let i = 0; i < pendingAudio.length; i += 1) {
            const audio = pendingAudio[i];
            if (socket) {
              socket.send({
                type: 'input_audio_buffer.append',
                audio,
              });
            }
          }
          pendingAudio.length = 0;
        });

        // Live transcription deltas
        socket.on('conversation.item.input_audio_transcription.delta', (event: any) => {
          if (destroyed || !transcriptCb) return;
          const delta = event?.delta;
          if (typeof delta === 'string' && delta.length > 0) {
            transcriptCb(delta, false);
          }
        });

        // Final transcription for an utterance
        socket.on('conversation.item.input_audio_transcription.completed', (event: any) => {
          if (destroyed) return;
          const text = event?.transcript;
          if (text && transcriptCb) {
            transcriptCb(String(text), true);
          }
          if (endOfSpeechCb) {
            endOfSpeechCb();
          }
        });

        socket.on('error', (err: any) => {
          if (!destroyed) {
            logger.warn({
              message: err?.message ?? String(err),
              serviceName: 'OpenaiSttService',
              actionName: 'createSession',
              traces: [{ stage: 'realtime' }],
            });
          }
        });
      } catch (err: any) {
        if (!destroyed) {
          logger.warn({
            message: err?.message ?? String(err),
            serviceName: 'OpenaiSttService',
            actionName: 'createSession',
            traces: [{ stage: 'connect' }],
          });
        }
      }
    })();

    return {
      writeAudio(buffer: Buffer) {
        if (destroyed) return;
        const audio = buffer.toString('base64');
        if (!socket || !ready) {
          pendingAudio.push(audio);
          return;
        }
        socket.send({
          type: 'input_audio_buffer.append',
          audio,
        });
      },
      endInput() {
        if (destroyed) return;
        if (socket) {
          socket.send({ type: 'input_audio_buffer.commit' });
        }
      },
      onTranscript(callback: (text: string, isFinal?: boolean) => void) {
        transcriptCb = callback;
      },
      onEndOfSpeech(callback: () => void) {
        endOfSpeechCb = callback;
      },
      destroy() {
        destroyed = true;
        transcriptCb = null;
        endOfSpeechCb = null;
        if (socket) {
          try {
            socket.close({ code: 1000, reason: 'stt session destroyed' });
          } catch (e) {
            logger.warn({
              message: e instanceof Error ? e.message : String(e),
              serviceName: 'OpenaiSttService',
              actionName: 'destroy',
              traces: [{ stage: 'close' }],
            });
          }
          socket = null;
        }
      },
    };
  }
}
