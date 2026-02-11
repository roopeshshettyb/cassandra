import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { AgentToolContext } from './langgraph-tools.context';
import { createAgentTools } from './langgraph.tools';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RestaurantService } from '../restaurant/restaurant.service';

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
  ) {}

  /**
   * JSON Schema compatible metadata for tools, in the shape expected by
   * OpenAI Realtime `session.tools`.
   */
  getToolsMetadata(ctx: AgentToolContext): RealtimeToolDefinition[] {
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService);

    return tools.map((tool: DynamicStructuredTool) => {
      const openaiTool = convertToOpenAITool(tool);

      if (openaiTool.type !== 'function' || !openaiTool.function) {
        throw new Error(`Unexpected tool format from convertToOpenAITool for tool: ${tool.name}`);
      }

      return {
        type: openaiTool.type,
        name: openaiTool.function.name,
        description: openaiTool.function.description ?? '',
        parameters: openaiTool.function.parameters ?? {},
      };
    });
  }

  /**
   * Execute a tool by name using the same implementations that the
   * LangGraph agent relies on, so behavior stays consistent between
   * text and voice paths.
   */
  async executeTool(ctx: AgentToolContext, name: string, args: Record<string, unknown>): Promise<unknown> {
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService, this.restaurantService);
    const tool = tools.find((t: DynamicStructuredTool) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.invoke(args);
  }
}

