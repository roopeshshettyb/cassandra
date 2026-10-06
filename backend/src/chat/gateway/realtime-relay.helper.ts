import { VoiceRealtimeService } from '../voice-realtime.service';
import { ChatContextService } from '../../chat-context/chat-context.service';
import { MessagesService } from '../../messages/messages.service';
import { Message, MessageRole, ToolCallRecord } from '../../messages/message.model';
import { TokenUsage } from '../../costs/costs.pricing';

export interface RealtimeRelayDeps {
  voiceRealtimeService: VoiceRealtimeService;
  messagesService: MessagesService;
  chatContextService: ChatContextService;
  logError: (message: string, err: Error) => void;
}

/** One finished spoken turn, persisted, handed to the gateway for what is specific to it. */
export interface RealtimeTurn {
  cleanUser?: string;
  cleanAssistant?: string;
  finalAssistantText: string;
  toolCalls: ToolCallRecord[];
  usage?: TokenUsage;
  assistantMessage: Message | null;
}

export interface RealtimeRelayHooks {
  /** Before the turn is consumed — the concierge copies booking context back onto its session here. */
  beforeTurn?: () => void;
  /** After the turn is persisted, before the client is told it ended — costs, evaluation. */
  afterTurn?: (turn: RealtimeTurn) => void;
}

/**
 * Relay one OpenAI Realtime server event to the browser, and persist a turn when
 * it completes.
 *
 * Shared by the concierge and the public reservation line so both run the same
 * event handling rather than two copies of it. Everything here is identical for
 * the two; what differs — who to bill, whether to evaluate, what to copy back
 * onto the session — comes in through the hooks, in the order the concierge
 * always ran it.
 */
export async function relayRealtimeEvent(
  client: any,
  event: any,
  chatId: number,
  deps: RealtimeRelayDeps,
  hooks: RealtimeRelayHooks = {},
): Promise<void> {
  switch (event.type) {
    case 'conversation.item.input_audio_transcription.completed': {
      const transcript = event?.transcript;
      if (typeof transcript === 'string' && transcript.trim().length) {
        client.emit('voice_user_message', { text: transcript });
      }
      break;
    }
    case 'response.output_text.delta':
    case 'response.output_audio_transcript.delta':
      client.emit('voice_text_chunk', { delta: event.delta || '' });
      break;
    case 'response.done': {
      if (event._skipVoiceTextEnd) {
        break;
      }
      hooks.beforeTurn?.();
      const { userTranscript, assistantText, toolCalls, usage } = deps.voiceRealtimeService.consumeTranscriptsAndTools(client.id);

      const finalAssistantText =
        (assistantText && assistantText.trim().length ? assistantText : undefined) ??
        (typeof event.output_text === 'string' ? event.output_text : undefined) ??
        (typeof event.output_audio_transcript === 'string' ? event.output_audio_transcript : undefined) ??
        '';
      const cleanUser = userTranscript?.trim();
      const cleanAssistant = finalAssistantText?.trim();

      let userMessage: Message | null = null;
      let assistantMessage: Message | null = null;
      try {
        if (cleanUser) {
          userMessage = await deps.messagesService.create(chatId, MessageRole.USER, cleanUser);
        }
        if (cleanAssistant) {
          assistantMessage = await deps.messagesService.create(
            chatId,
            MessageRole.ASSISTANT,
            cleanAssistant,
            toolCalls.length ? toolCalls : undefined,
          );
        }
        deps.chatContextService.rebuildCache(
          chatId,
          [userMessage, assistantMessage].filter((m): m is Message => m !== null),
        );
      } catch (err) {
        deps.logError('Failed to persist voice messages', err as Error);
      }

      hooks.afterTurn?.({ cleanUser, cleanAssistant, finalAssistantText, toolCalls, usage, assistantMessage });

      client.emit('voice_text_end', { text: finalAssistantText, toolCalls });
      break;
    }
    case 'response.output_audio.delta':
      client.emit('voice_audio_chunk', { delta: event.delta });
      break;
    case 'response.output_audio.done':
      client.emit('voice_audio_end');
      break;
    case 'error':
      client.emit('error', { message: event?.error?.message || 'Realtime error' });
      break;
    default:
      break;
  }
}
