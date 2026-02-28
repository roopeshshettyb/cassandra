import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

export interface StreamToClientOptions {
  emitEnd?: boolean;
  /** Chat language code (e.g. en, hi, ta, te, kn); used by Sarvam/Lightning for TTS language. */
  languageCode?: string | null;
}

@Injectable()
export class OpenaiTtsService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const llmConfig = this.constantsService.private.LLM;
    const sttCommon = llmConfig.STT_CONFIG.COMMON;
    const ttsConfig = llmConfig.TTS_CONFIG;
    const openaiTts = ttsConfig.OPENAI;
    const openaiStt = llmConfig.STT_CONFIG.OPENAI;

    const apiKey = openaiStt.API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for TTS provider openai');
    }

    const openai = new OpenAI({ apiKey });

    try {
      const response = await openai.audio.speech.create({
        model: openaiTts.MODEL,
        voice: openaiTts.VOICE,
        input: text,
        response_format: openaiTts.RESPONSE_FORMAT,
        stream_format: 'audio',
      });

      const reader = response.body!.getReader();
      // Trim only if OPENAI_TTS_TRIM_INITIAL_BYTES is set. Default 0: OpenAI docs describe PCM as raw samples with no leading silence; trimming cut the first word. Community examples use 4096 as read chunk size, not bytes to discard.
      const trimBytes = openaiTts.TRIM_INITIAL_BYTES ?? 0;
      let trimRemaining = trimBytes;
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        let offset = 0;
        if (trimRemaining > 0) {
          if (value.length <= trimRemaining) {
            trimRemaining -= value.length;
            continue;
          }
          offset = trimRemaining;
          trimRemaining = 0;
        }

        const slice = value.subarray(offset);
        chunks.push(slice);
        totalLength += slice.length;
      }

      if (totalLength > 0) {
        const out = new Uint8Array(totalLength);
        let pos = 0;
        for (let i = 0; i < chunks.length; i += 1) {
          out.set(chunks[i], pos);
          pos += chunks[i].length;
        }
        client.emit('voice_audio_chunk', { delta: Buffer.from(out).toString('base64') });
      }

      const emitEnd = options?.emitEnd !== false;
      if (emitEnd) {
        client.emit('voice_audio_end');
        client.emit('voice_ready');
        client.voiceBusy = false;
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'OpenaiTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'openai' }],
      });
      throw err;
    }
  }
}
