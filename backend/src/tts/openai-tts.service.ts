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
    if (!text || !text.trim()) {
      this.logger.warn('[OpenAI TTS] Empty text, skipping');
      client.emit('voice_audio_end');
      client.emit('voice_ready');
      client.voiceBusy = false;
      return;
    }

    const llmConfig = this.constantsService.private.LLM;
    const ttsConfig = llmConfig.TTS_CONFIG;
    const openaiTts = ttsConfig.OPENAI;
    const apiKey = llmConfig.STT_CONFIG.OPENAI.API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for TTS provider openai');
    }

    const openai = new OpenAI({ apiKey });

    try {
      this.logger.log(`[OpenAI TTS] Requesting speech for ${text.length} chars, model=${openaiTts.MODEL}`);

      const response = await openai.audio.speech.create({
        model: openaiTts.MODEL,
        voice: openaiTts.VOICE,
        input: text,
        response_format: openaiTts.RESPONSE_FORMAT,
      });

      const arrayBuffer = await response.arrayBuffer();
      let audioBuffer = Buffer.from(arrayBuffer);

      this.logger.log(`[OpenAI TTS] Got ${audioBuffer.length} bytes`);

      const trimBytes = openaiTts.TRIM_INITIAL_BYTES ?? 0;
      if (trimBytes > 0 && audioBuffer.length > trimBytes) {
        audioBuffer = audioBuffer.subarray(trimBytes);
      }

      if (audioBuffer.length > 0) {
        client.emit('voice_audio_chunk', { delta: audioBuffer.toString('base64') });
      }

      client.emit('voice_audio_end');
      this.logger.log('TTS Completed');
      client.emit('voice_ready');
      client.voiceBusy = false;
    } catch (err: any) {
      this.logger.error(`[OpenAI TTS] Error: ${err?.message ?? err}`);
      if (err?.stack) this.logger.error(err.stack);
      client.emit('voice_audio_end');
      client.emit('voice_ready');
      client.voiceBusy = false;
    }
  }
}
