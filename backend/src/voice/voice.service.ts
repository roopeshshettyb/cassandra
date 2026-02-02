import { Injectable } from '@nestjs/common';

@Injectable()
export class VoiceService {
  // Tool handlers - currently just logging
  async callRoomService(details: any) {
    console.log('🔔 Room Service Called:', details);
    return { success: true, message: 'Room service has been notified' };
  }

  async requestTowels(quantity: number) {
    console.log('🧺 Towels Requested:', quantity);
    return { success: true, message: `${quantity} towels will be delivered shortly` };
  }

  async orderFood(order: any) {
    console.log('🍽️ Food Order Placed:', order);
    return { success: true, message: 'Your food order has been placed' };
  }
}
