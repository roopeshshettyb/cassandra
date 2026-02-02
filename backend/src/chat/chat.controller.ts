import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('messages')
  async getMessages(@Query('sessionId') sessionId: string) {
    const messages = await this.chatService.getRecentMessages(sessionId, 50);
    return { messages: messages.reverse() };
  }
}
