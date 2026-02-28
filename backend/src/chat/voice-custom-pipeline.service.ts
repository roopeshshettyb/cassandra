import { Injectable, Logger } from '@nestjs/common';
import { ChatContextService } from '../chat-context/chat-context.service';
import { ConstantsService } from '../common/constants/constants.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';
import { SttFactoryService } from '../stt/stt-factory.service';
import type { ISttSession } from '../stt/stt-session.interface';
import { TtsFactoryService } from '../tts/tts-factory.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatSession } from './gateway/chat-session.interface';

export interface VoiceTurnStatistics {
  lastAudioAt: number;
  responseStart: number;
  sttMs: number;
  llmStart: number;
  llmMs: number;
  ttsMs: number;
  totalProcessingMs: number;
}

@Injectable()
export class VoiceCustomPipelineService {
  private readonly logger = new Logger(VoiceCustomPipelineService.name);

  constructor(
    private readonly constantsService: ConstantsService,
    private readonly costsService: CostsService,
    private readonly sttFactory: SttFactoryService,
    private readonly ttsFactory: TtsFactoryService,
    private readonly chatLlmService: ChatLlmService,
  ) {}

  /**
   * Splits buffer on sentence-ending punctuation (.!?) and streams each complete sentence to TTS.
   */
  private flushCompletedSentencesToTts(
    state: { sentenceBuffer: string; fullText: string; ttsQueue: Promise<void>; statistics: VoiceTurnStatistics; languageCode: string | null },
    client: any,
    provider: { streamToClient: (client: any, text: string, options?: { emitEnd?: boolean; languageCode?: string | null }) => Promise<void> },
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
      state.fullText += sentence;
      state.ttsQueue = state.ttsQueue.then(async () => {
        const t0 = Date.now();
        await provider.streamToClient(client, sentence, { emitEnd: false, languageCode: state.languageCode });
        state.statistics.ttsMs += Date.now() - t0;
      });
      client.emit('voice_text_chunk', { delta: sentence });
    }
  }

  public startSession(client: any): void {
    if (client.sttSession) {
      client.sttSession.destroy();
      client.sttSession = null;
    }
    if (client.voiceBusy) {
      return;
    }
    try {
      const sttProvider = this.constantsService.private.LLM.STT_CONFIG.PROVIDER;
      const ttsProvider = this.constantsService.private.LLM.TTS_CONFIG.PROVIDER;
      this.logger.log(`Initializing Custom Pipeline STT=${sttProvider}, TTS=${ttsProvider}`);

      const factory = this.sttFactory.getFactory();
      const sttSession: ISttSession = factory.createSession();
      client.sttSession = sttSession;
      client._voiceStatistics = {
        lastAudioAt: Date.now(),
        responseStart: 0,
        sttMs: 0,
        llmStart: 0,
        llmMs: 0,
        ttsMs: 0,
        totalProcessingMs: 0,
      } as VoiceTurnStatistics;
      let lastFinalTranscript = '';

      sttSession.onTranscript((text: string, isFinal?: boolean) => {
        if (isFinal) lastFinalTranscript = text;
        client.emit('voice_user_chunk', { delta: text, isFinal: !!isFinal });
      });

      sttSession.onEndOfSpeech(() => {
        sttSession.endInput();
        if (client.sttSession === sttSession) {
          client.sttSession = null;
        }
        sttSession.destroy();
        client.emit('voice_turn_end');

        const statistics = client._voiceStatistics as VoiceTurnStatistics;
        statistics.responseStart = Date.now();
        statistics.sttMs = statistics.responseStart - (statistics.lastAudioAt ?? statistics.responseStart);
        statistics.llmStart = Date.now();
        statistics.llmMs = 0;
        statistics.ttsMs = 0;
        statistics.totalProcessingMs = 0;

        const textToSpeak = lastFinalTranscript;
        const session: ChatSession | undefined = client.session;

        if (!session) {
          client.emit('error', { message: 'Not authenticated' });
          client.emit('voice_ready');
          return;
        }

        if (!textToSpeak || typeof textToSpeak !== 'string') {
          client.emit('voice_ready');
          return;
        }

        client.emit('voice_user_message', { text: textToSpeak });

        client.voiceBusy = true;
        const provider = this.ttsFactory.getProvider();

        const state = {
          sentenceBuffer: '',
          fullText: '',
          ttsQueue: Promise.resolve() as Promise<void>,
          statistics,
          languageCode: session.languageCode ?? null,
        };

        this.chatLlmService
          .streamUserMessage(session, textToSpeak, {
            mode: 'voice',
            onChunk: (chunk: string) => {
              if (!chunk) return;
              state.sentenceBuffer += chunk;
              this.flushCompletedSentencesToTts(state, client, provider);
            },
            onEnd: async (result) => {
              state.statistics.llmMs = Date.now() - state.statistics.llmStart;
              if (state.sentenceBuffer.trim().length > 0) {
                state.fullText += state.sentenceBuffer.trim();
                await state.ttsQueue;
                const t0 = Date.now();
                await provider.streamToClient(client, state.sentenceBuffer.trim(), { emitEnd: true, languageCode: state.languageCode });
                state.statistics.ttsMs += Date.now() - t0;
              } else {
                await state.ttsQueue;
              }
              state.statistics.totalProcessingMs = Date.now() - state.statistics.responseStart;
              this.logger.log({
                message: 'Voice cycle complete',
                serviceName: 'VoiceCustomPipelineService',
                actionName: 'startSession',
                traces: [
                  { sttMs: state.statistics.sttMs },
                  { llmMs: state.statistics.llmMs },
                  { ttsMs: state.statistics.ttsMs },
                  { totalProcessingMs: state.statistics.totalProcessingMs },
                ],
              });
              client.emit('voice_text_end', { text: result.fullContent || state.fullText });
            },
          })
          .catch((err: any) => {
            this.logger.error('LLM/TTS Pipeline Error: ' + err?.message);
            this.logger.error(err?.stack);
            this.logger.warn({
              message: err?.message ?? String(err),
              traces: [{ error: 'LLM+TTS' }],
            });
            client.emit('error', { message: 'Voice response failed' });
            client.emit('voice_ready');
            client.voiceBusy = false;
          });
      });

      client.emit('voice_ready');
    } catch (err: any) {
      this.logger.error({
        error: err,
        traces: [{ stage: 'rt_error', message: err?.message || 'STT session failed' }],
      });
      client.emit('error', { message: err?.message || 'STT session failed' });
    }
  }

  public handleAudioChunk(client: any, base64Audio: string): void {
    const sttSession: ISttSession | undefined = client.sttSession;
    if (!sttSession) {
      return;
    }
    try {
      const buffer = Buffer.from(base64Audio, 'base64');
      sttSession.writeAudio(buffer);
      if (client._voiceStatistics) {
        (client._voiceStatistics as VoiceTurnStatistics).lastAudioAt = Date.now();
      }
    } catch (_) {}
  }

  public stopSession(client: any): void {
    const sttSession: ISttSession | undefined = client.sttSession;
    if (sttSession) {
      sttSession.endInput();
      sttSession.destroy();
      client.sttSession = null;
    }
    if (client.voiceBusy) {
      client.voiceBusy = false;
    }
  }
}
