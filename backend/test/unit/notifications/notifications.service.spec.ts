import { NotificationsService } from '../../../src/notifications/notifications.service';
import { mock, guest, loose } from '../helpers';

describe('NotificationsService', () => {
  let factory: any, accountsService: any;
  let service: NotificationsService;
  const hotel: any = { id: 1 };
  const actor = guest();

  beforeEach(() => {
    factory = mock();
    accountsService = mock();
    service = new NotificationsService(mock(), factory, accountsService);
  });

  it('registers a device token, ignoring an empty one', async () => {
    await service.registerDevice(5, '');
    await service.registerDevice(5, 'tok');
    expect(accountsService.addPushToken.mock.calls).toEqual([[5, 'tok']]);
  });

  describe('notify', () => {
    const request: any = { id: 1 };
    const booking: any = { id: 2 };

    it.each([
      ['NEW_REQUEST', { request }, 'notifyNewRequest'],
      ['REQUEST_UPDATED', { request }, 'notifyRequestUpdated'],
      ['NEW_BOOKING', { booking, guest: actor }, 'notifyNewBooking'],
      ['NEW_MESSAGE', { request, messagePreview: 'hi' }, 'notifyMessageInRequest'],
    ])('%s goes to the factory', async (eventType, extra, method) => {
      await service.notify({ eventType: loose(eventType), hotel, actor, ...extra });
      expect(factory[method]).toHaveBeenCalled();
    });

    it.each(['NEW_REQUEST', 'REQUEST_UPDATED', 'NEW_BOOKING', 'NEW_MESSAGE'])('%s without its record does nothing', async (eventType) => {
      await service.notify({ eventType: loose(eventType), hotel, actor });
      expect(Object.keys(factory)).toHaveLength(0);
    });
  });
});
