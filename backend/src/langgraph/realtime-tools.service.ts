import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { StructuredToolInterface } from '@langchain/core/tools';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { AgentToolContext } from './langgraph-tools.context';
import { createAgentTools } from './langgraph.tools';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ChatService } from '../chat/chat.service';
import { HotelsService } from '../hotels/hotels.service';
import { ConstantsService } from '../common/constants/constants.service';

export interface RealtimeToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

@Injectable()
export class RealtimeToolsService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly requestsService: RequestsService,
    private readonly restaurantService: RestaurantService,
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => HotelsService))
    private readonly hotelsService: HotelsService,
    private readonly constantsService: ConstantsService,
  ) {}

  /**
   * JSON Schema compatible metadata for tools, in the shape expected by
   * OpenAI Realtime `session.tools`.
   */
  getToolsMetadata(ctx: AgentToolContext): RealtimeToolDefinition[] {
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService, this.chatService, this.hotelsService, this.constantsService);

    return tools.map((tool: StructuredToolInterface) => {
      const openaiTool = convertToOpenAITool(tool);

      if (openaiTool.type !== 'function' || !openaiTool.function) {
        throw new Error(`Unexpected tool format from convertToOpenAITool for tool: ${tool.name}`);
      }

      return {
        type: openaiTool.type,
        name: openaiTool.function.name,
        description: openaiTool.function.description ?? '',
        parameters: (openaiTool.function.parameters ?? {}) as Record<string, unknown>,
      };
    });
  }

  /**
   * Execute a tool by name using the same implementations that the
   * LangGraph agent relies on, so behavior stays consistent between
   * text and voice paths.
   */
  async executeTool(ctx: AgentToolContext, name: string, args: Record<string, unknown>): Promise<unknown> {
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService, this.chatService, this.hotelsService, this.constantsService);
    const tool = tools.find((t: StructuredToolInterface) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.invoke(args);
  }
}

