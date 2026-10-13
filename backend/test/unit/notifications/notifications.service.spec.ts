import { NotificationsService } from '../../../src/notifications/notifications.service';
import { NotificationsController } from '../../../src/notifications/notifications.controller';
import { NotificationType } from '../../../src/notifications/notifications.model';
import { mock, constants, guest, loose } from '../helpers';

describe('NotificationsService', () => {
  let notifications: any, factory: any, accountsService: any;
  let service: NotificationsService;
  const hotel: any = { id: 1 };
  const actor = guest();

  beforeEach(() => {
    notifications = mock();
    factory = mock();
    accountsService = mock();
    service = new NotificationsService(notifications, factory, accountsService);
  });

  it('creates a system notification, unread, by default', async () => {
    await service.create(loose({ title: 't' }));
    expect(notifications.create).toHaveBeenCalledWith({ title: 't', type: NotificationType.SYSTEM, read: false });
  });

  it('lists an account notifications newest first', async () => {
    await service.findByAccountId(5);
    expect(notifications.findAll).toHaveBeenCalledWith({ where: { accountId: 5 }, order: [['createdAt', 'DESC']] });
  });

  describe('preferences', () => {
    it('defaults to everything on', async () => {
      accountsService.findOne.mockResolvedValue({});
      await expect(service.getPreferences(5)).resolves.toEqual({ pushEnabled: true, emailEnabled: true });
    });

    it('reads the saved preferences', async () => {
      accountsService.findOne.mockResolvedValue({ notificationPreferences: { push: false, email: true } });
      await expect(service.getPreferences(5)).resolves.toEqual({ pushEnabled: false, emailEnabled: true });
    });

    it('changes only what was sent', async () => {
      accountsService.findOne.mockResolvedValue({ notificationPreferences: { push: true, email: true } });
      await service.updatePreferences(5, { emailEnabled: false });
      expect(accountsService.update).toHaveBeenCalledWith({ notificationPreferences: { push: true, email: false } }, { id: 5 });
    });
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

describe('NotificationsController', () => {
  let service: any;
  let controller: NotificationsController;
  const me = guest();

  beforeEach(() => {
    service = mock({ findByAccountId: jest.fn(async () => [{ id: 1 }]), getPreferences: jest.fn(async () => ({ pushEnabled: true })) });
    controller = new NotificationsController(service, constants);
  });

  it('lists only the caller notifications', async () => {
    await expect(controller.findAll(me)).resolves.toEqual({ success: true, message: constants.public.NOTIFICATIONS_FETCHED, data: [{ id: 1 }] });
    expect(service.findByAccountId).toHaveBeenCalledWith(me.id);
  });

  it('marks as read only a notification of the caller', async () => {
    await controller.markAsRead('7', me);
    expect(service.update).toHaveBeenCalledWith({ read: true }, { id: 7, accountId: me.id });
  });

  it('registers a device for the caller', async () => {
    await expect(controller.registerDevice(me, loose({ token: 't' }))).resolves.toMatchObject({ success: true });
    expect(service.registerDevice).toHaveBeenCalledWith(me.id, 't');
  });

  it('reads and updates the caller preferences', async () => {
    await expect(controller.getPreferences(me)).resolves.toMatchObject({ message: constants.public.PREFERENCES_FETCHED, data: { pushEnabled: true } });
    await expect(controller.updatePreference(me, { pushEnabled: false })).resolves.toMatchObject({ message: constants.public.PREFERENCES_UPDATED });
    expect(service.updatePreferences).toHaveBeenCalledWith(me.id, { pushEnabled: false });
  });
});
