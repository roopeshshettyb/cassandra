import { Injectable, Inject } from '@nestjs/common';
import { Message, MessageRole, MessageType } from '../common/messages.model';
import { MESSAGES_REPOSITORY } from './messages.repository';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CASSANDRA_SYSTEM_PROMPT, CASSANDRA_TOOLS } from '../common/cassandra.config';
import { VoiceService } from '../voice/voice.service';

@Injectable()
export class ChatService {
  constructor(
    @Inject(MESSAGES_REPOSITORY) private messageModel: typeof Message,
    private configService: ConfigService,
    private voiceService: VoiceService,
  ) {}

  async getRecentMessages(sessionId: string, limit: number = 10): Promise<Message[]> {
    return this.messageModel.findAll({
      where: { sessionId },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  async saveMessage(sessionId: string, role: MessageRole, content: string, type: MessageType = MessageType.TEXT, accountUuid?: string, toolCalls?: any[]): Promise<Message> {
    return this.messageModel.create({
      sessionId,
      role,
      content,
      type,
      accountUuid,
      toolCalls,
    });
  }

  async sendMessage(sessionId: string, userMessage: string, accountUuid?: string): Promise<string> {
    // Save user message
    await this.saveMessage(sessionId, MessageRole.USER, userMessage, MessageType.TEXT, accountUuid);

    // Get recent messages for context
    const recentMessages = await this.getRecentMessages(sessionId, 10);
    const messages: any[] = recentMessages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add system prompt
    messages.unshift({
      role: 'system',
      content: CASSANDRA_SYSTEM_PROMPT,
    });

    // Call OpenAI
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages,
        tools: CASSANDRA_TOOLS,
        tool_choice: 'auto',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const assistantMessage = response.data.choices[0].message;
    let finalResponse = assistantMessage.content || '';

    // Handle tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        let result;
        switch (functionName) {
          case 'call_room_service':
            result = await this.voiceService.callRoomService(functionArgs);
            break;
          case 'request_towels':
            result = await this.voiceService.requestTowels(functionArgs.quantity);
            break;
          case 'order_food':
            result = await this.voiceService.orderFood(functionArgs);
            break;
        }

        toolResults.push(result);
      }

      // Get confirmation response from OpenAI
      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
      });

      for (let i = 0; i < assistantMessage.tool_calls.length; i++) {
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResults[i]),
          tool_call_id: assistantMessage.tool_calls[i].id,
        } as any);
      }

      const confirmationResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      finalResponse = confirmationResponse.data.choices[0].message.content;

      // Save with tool calls
      await this.saveMessage(sessionId, MessageRole.ASSISTANT, finalResponse, MessageType.TEXT, accountUuid, assistantMessage.tool_calls);
    } else {
      // Save assistant message
      await this.saveMessage(sessionId, MessageRole.ASSISTANT, finalResponse, MessageType.TEXT, accountUuid);
    }

    return finalResponse;
  }
}
