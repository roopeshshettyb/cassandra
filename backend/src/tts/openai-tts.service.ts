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
      });

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const base64 = audioBuffer.toString('base64');
      client.emit('voice_audio_chunk', { delta: base64 });
      client.emit('voice_audio_end');
      this.logger.log('TTS Completed');
      client.emit('voice_ready');
      client.voiceBusy = false;
    } catch (err: any) {
      this.logger.warn('[OpenAI TTS] Error during speech synthesis', err?.message ?? err);
    }
  }
}
