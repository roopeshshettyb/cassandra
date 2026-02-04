import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentToolContext } from './langgraph-tools.context';
import { createAgentTools } from './langgraph.tools';
import { BookingsService } from '../bookings/bookings.service';
import { RequestsService } from '../requests/requests.service';
import { RequestType, RequestUrgency, RequestStatus } from '../requests/requests.model';

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
  ) {}

  /**
   * JSON Schema compatible metadata for tools, in the shape expected by
   * OpenAI Realtime `session.tools`.
   */
  getToolsMetadata(_ctx: AgentToolContext): RealtimeToolDefinition[] {
    const enumRequestType = this.enumValues(RequestType);
    const enumRequestUrgency = this.enumValues(RequestUrgency);
    const enumRequestStatus = this.enumValues(RequestStatus);

    return [
      {
        type: 'function',
        name: 'create_request',
        description:
          'Create a new service request for the current booking (e.g. room service, housekeeping, laundry, airport transfer). Use the current booking context; do not ask for hotel or guest ids.',
        parameters: {
          type: 'object',
          properties: {
            requestType: {
              type: 'string',
              enum: enumRequestType,
              description: 'The type of request to create.',
            },
            urgency: {
              type: 'string',
              enum: enumRequestUrgency,
              description: 'How urgent the request is.',
            },
            userNotes: {
              type: 'array',
              description: 'Optional free-form user notes to attach to the request.',
              items: { type: 'string' },
            },
            data: {
              type: 'object',
              description: 'Optional structured payload with request-specific data.',
              additionalProperties: true,
            },
          },
          required: ['requestType', 'urgency'],
        },
      },
      {
        type: 'function',
        name: 'update_request',
        description: 'Update an existing request (e.g. status, urgency, or custom data).',
        parameters: {
          type: 'object',
          properties: {
            requestId: {
              type: 'number',
              description: 'The id of the request to update.',
            },
            urgency: {
              type: 'string',
              enum: enumRequestUrgency,
              description: 'Optionally update the urgency level.',
            },
            status: {
              type: 'string',
              enum: enumRequestStatus,
              description: 'Optionally update the status.',
            },
            data: {
              type: 'object',
              description: 'Optional structured payload with request-specific data to merge.',
              additionalProperties: true,
            },
          },
          required: ['requestId'],
        },
      },
      {
        type: 'function',
        name: 'append_user_message',
        description: 'Append a user (guest) message to an existing request.',
        parameters: {
          type: 'object',
          properties: {
            requestId: {
              type: 'number',
              description: 'The id of the request to append the message to.',
            },
            message: {
              type: 'string',
              description: 'The message to append.',
            },
          },
          required: ['requestId', 'message'],
        },
      },
      {
        type: 'function',
        name: 'append_staff_message',
        description: 'Append a staff note to an existing request. Use when acting on behalf of hotel staff.',
        parameters: {
          type: 'object',
          properties: {
            requestId: {
              type: 'number',
              description: 'The id of the request to append the message to.',
            },
            message: {
              type: 'string',
              description: 'The staff message to append.',
            },
          },
          required: ['requestId', 'message'],
        },
      },
      {
        type: 'function',
        name: 'get_booking',
        description:
          'Get the current booking details (dates, hotel, etc.). Use this to answer guest questions about this booking.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        type: 'function',
        name: 'get_hotel',
        description:
          'Get the hotel information for the current booking (name, address, check-in/out times, amenities hours, wifi, etc.). Use this to answer guest questions about the hotel associated with this booking.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Execute a tool by name using the same implementations that the
   * LangGraph agent relies on, so behavior stays consistent between
   * text and voice paths.
   */
  async executeTool(ctx: AgentToolContext, name: string, args: Record<string, unknown>): Promise<unknown> {
    const tools = createAgentTools(ctx, this.bookingsService, this.requestsService);
    const tool = tools.find((t: DynamicStructuredTool) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.invoke(args);
  }

  private enumValues(e: Record<string, unknown>): string[] {
    return Object.values(e).filter((v) => typeof v === 'string') as string[];
  }
}

