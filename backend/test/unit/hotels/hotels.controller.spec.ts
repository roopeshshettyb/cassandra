import { HotelsController } from '../../../src/hotels/hotels.controller';
import { HotelsService } from '../../../src/hotels/hotels.service';
import { mock, constants, admin, owner } from '../helpers';

describe('HotelsController', () => {
  let onboarding: any;
  let controller: HotelsController;

  beforeEach(() => {
    // The real gate, so the onboarding routes are tested against the actual role rule.
    const realGate = new HotelsService(mock(), mock(), mock(), mock(), mock(), mock(), mock(), mock(), constants, mock());
    const hotelsService = mock({ ensureCanAddHotel: jest.fn((a: any) => realGate.ensureCanAddHotel(a)) });
    onboarding = mock();
    const maps = mock({ searchPlaces: jest.fn(async () => [{ id: 'p' }]) });
    controller = new HotelsController(hotelsService, onboarding, maps);
  });

  it.each([
    ['admin', admin],
    ['owner', owner],
  ])('lets %s search, analyze and extract', async (_name, who) => {
    await expect(controller.search('taj', who())).resolves.toMatchObject({ success: true, data: [{ id: 'p' }] });
    await controller.analyze('p', who());
    await controller.extract({ placeId: 'p' }, who());
    expect(onboarding.analyzePlace).toHaveBeenCalledWith('p');
    expect(onboarding.crawlAndExtract).toHaveBeenCalledWith('p', undefined);
  });
});
