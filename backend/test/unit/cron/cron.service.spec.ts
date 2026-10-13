import { CronService } from '../../../src/cron/cron.service';
import { mock } from '../helpers';

describe('CronService', () => {
  it('sends the pending booking invites, and sizes the cache', async () => {
    const cache = mock();
    const bookings = mock();
    const cron = new CronService(cache, bookings);
    await cron.sendPendingBookingInvites();
    cron.handleCacheCleanup();
    expect(bookings.sendPendingInviteEmails).toHaveBeenCalled();
    expect(cache.size).toHaveBeenCalled();
  });
});
