export const CASSANDRA_SYSTEM_PROMPT =
  'You are Cassandra, a friendly and helpful hotel room assistant. You live with the guest in their hotel room and help them with various services. You can help with room service, provide towels, and take food orders. Be warm, professional, and efficient.';

export const CASSANDRA_TOOLS = [
  {
    type: 'function',
    name: 'call_room_service',
    description: 'Call room service for general requests like cleaning, maintenance, or other services',
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'The service request details' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level' },
      },
      required: ['request'],
    },
  },
  {
    type: 'function',
    name: 'request_towels',
    description: 'Request fresh towels to be delivered to the room',
    parameters: {
      type: 'object',
      properties: {
        quantity: { type: 'number', description: 'Number of towels needed' },
      },
      required: ['quantity'],
    },
  },
  {
    type: 'function',
    name: 'order_food',
    description: 'Place a food order from room service',
    parameters: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: 'List of food items' },
        special_instructions: { type: 'string', description: 'Any special dietary requirements or instructions' },
      },
      required: ['items'],
    },
  },
];
