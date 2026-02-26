import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConstantsService } from '../common/constants/constants.service';

export interface StreamToClientOptions {
  emitEnd?: boolean;
}

@Injectable()
export class OpenaiTtsService {
  private readonly logger = new Logger(OpenaiTtsService.name);

  constructor(private readonly constantsService: ConstantsService) {}

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

      client.emit('voice_audio_end');
      this.logger.log('TTS Completed');
      client.emit('voice_ready');
      client.voiceBusy = false;
    } catch (err: any) {
      this.logger.warn('[OpenAI TTS] Error during speech synthesis', err?.message ?? err);
    }
  }
}
