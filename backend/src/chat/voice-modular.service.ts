import { Injectable, Logger } from '@nestjs/common';
import { SttService } from './stt.service';
import { LangGraphService, StreamInput } from '../langgraph/langgraph.service';
import { TtsService } from './tts.service';
import { AgentToolContext } from '../langgraph/langgraph-tools.context';
import { MessagesService } from '../messages/messages.service';
import { MessageRole } from '../messages/message.model';
import { ChatContextService } from '../chat-context/chat-context.service';
import { CostsService } from '../costs/costs.service';
import { CostType } from '../costs/costs.model';

@Injectable()
export class VoiceModularService {
  private readonly logger = new Logger(VoiceModularService.name);
  private audioBuffers: Map<string, Buffer[]> = new Map();

  constructor(
    private readonly sttService: SttService,
    private readonly langGraphService: LangGraphService,
    private readonly ttsService: TtsService,
    private readonly messagesService: MessagesService,
    private readonly chatContextService: ChatContextService,
    private readonly costsService: CostsService,
  ) {}

  appendAudio(clientId: string, audioChunkBase64: string) {
    const buffer = Buffer.from(audioChunkBase64, 'base64');
    const existing = this.audioBuffers.get(clientId) || [];
    existing.push(buffer);
    this.audioBuffers.set(clientId, existing);
    this.logger.log(`[appendAudio] clientId=${clientId}, chunk size=${buffer.length}, total chunks=${existing.length}`);
  }

  clearAudio(clientId: string) {
    this.audioBuffers.delete(clientId);
  }

  async processVoice(
    clientId: string,
    toolContext: AgentToolContext,
    callbacks: {
      onUserTranscript: (text: string) => void;
      onTextDelta: (text: string) => void;
      onTextEnd: (text: string, toolCalls: any[]) => void;
      onAudioChunk: (base64: string) => void;
      onAudioEnd: () => void;
      onError: (err: Error) => void;
    },
  ) {
    try {
      const chunks = this.audioBuffers.get(clientId);
      this.logger.log(`[processVoice] Found ${chunks?.length || 0} chunks for client ${clientId}`);
      if (!chunks || chunks.length === 0) {
        this.logger.warn(`[processVoice] No audio chunks for client ${clientId}`);
        return;
      }

      const fullPcmBuffer = Buffer.concat(chunks);
      this.logger.log(`[processVoice] fullPcmBuffer size=${fullPcmBuffer.length} bytes`);
      this.clearAudio(clientId);

      // 1. STT
      this.logger.log(`[processVoice] Starting STT for client ${clientId} using ${process.env.STT_PROVIDER || 'default'}...`);
      const wavBuffer = this.addWavHeader(fullPcmBuffer, 24000); // Assuming 24kHz from frontend
      const transcript = await this.sttService.transcribe(wavBuffer);
      this.logger.log(`[processVoice] STT Completed. Transcript: "${transcript}"`);
      
      if (!transcript || !transcript.trim()) {
        this.logger.warn('[processVoice] Empty transcript — stopping pipeline');
        return;
      }
      callbacks.onUserTranscript(transcript);

      // 2. LLM (Streaming)
      this.logger.log(`Processing LLM for transcript: "${transcript}"`);
      await this.messagesService.create(toolContext.chatId, MessageRole.USER, transcript);
      
      const streamInput: StreamInput = {
        messages: [{ role: 'user', content: transcript }],
      };

      let fullAssistantText = '';
      let toolCalls: any[] = [];
      let usage: any = null;

      const stream = this.langGraphService.stream(streamInput, toolContext);
      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullAssistantText += chunk;
          callbacks.onTextDelta(chunk);
        } else {
          toolCalls = chunk.toolCalls;
          usage = chunk.usage;
        }
      }
      this.logger.log(`[processVoice] LLM end: "${fullAssistantText.substring(0, 50)}..."`);

      callbacks.onTextEnd(fullAssistantText, toolCalls);

      // Persist Assistant Message
      const assistantMessage = await this.messagesService.create(
        toolContext.chatId, 
        MessageRole.ASSISTANT, 
        fullAssistantText, 
        toolCalls.length ? toolCalls : undefined
      );
      await this.chatContextService.rebuildCache(toolContext.chatId);

      // Record Costs
      if (usage) {
        this.costsService.recordLlmCost({
          type: CostType.LLM_VOICE,
          usage: {
          promptTokens: Number(usage.promptTokens) || 0,
          completionTokens: Number(usage.completionTokens) || 0,
          totalTokens: Number(usage.totalTokens) || (Number(usage.promptTokens) + Number(usage.completionTokens)) || 0,
          },
          bookingId: toolContext.bookingId,
          hotelId: toolContext.hotel ? (toolContext.hotel.id as number) : null,
          accountId: toolContext.account.id,
          role: toolContext.account.role,
          chatId: toolContext.chatId,
          messageId: assistantMessage.id,
        });
      }

      // 3. TTS
      if (fullAssistantText.trim()) {
        this.logger.log(`[processVoice] Starting TTS for text length: ${fullAssistantText.length}`);
        const audioBase64 = await this.ttsService.speak(fullAssistantText);
        if (audioBase64) {
          this.logger.log(`[processVoice] TTS success: generated ${audioBase64.length} base64 chars`);
          callbacks.onAudioChunk(audioBase64);
          callbacks.onAudioEnd();
        } else {
          this.logger.warn(`[processVoice] TTS returned null/empty audio`);
        }
      }
    } catch (err) {
      this.logger.error(`Error in VoiceModularService: ${err.message}`, err.stack);
      this.logger.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      callbacks.onError(err as Error);
    }
  }

  private addWavHeader(pcmBuffer: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const chunkSize = 36 + dataSize;

    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(chunkSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }
}
