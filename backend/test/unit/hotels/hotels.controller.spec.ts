import { ForbiddenException } from '@nestjs/common';
import { HotelsController } from '../../../src/hotels/hotels.controller';
import { HotelsService } from '../../../src/hotels/hotels.service';
import { mock, constants, admin, owner, staff, guest, loose } from '../helpers';

describe('HotelsController', () => {
  let hotelsService: any, onboarding: any, maps: any;
  let controller: HotelsController;

  beforeEach(() => {
    // The real gate, so the onboarding routes are tested against the actual role rule.
    const realGate = new HotelsService(mock(), mock(), mock(), mock(), mock(), mock(), mock(), mock(), constants, mock());
    hotelsService = mock({ ensureCanAddHotel: jest.fn((a: any) => realGate.ensureCanAddHotel(a)) });
    onboarding = mock({ listAllBrands: jest.fn(async () => [{ id: 1 }]) });
    maps = mock({ searchPlaces: jest.fn(async () => [{ id: 'p' }]) });
    controller = new HotelsController(hotelsService, onboarding, maps);
  });

  it('wraps the brand list in the standard response', async () => {
    await expect(controller.listBrands({})).resolves.toEqual({ success: true, message: null, data: [{ id: 1 }] });
  });

  it('converts ids from the path to numbers', async () => {
    const me = owner();
    await controller.findById('7', me);
    await controller.update('7', loose({ name: 'x' }), me);
    expect(hotelsService.findByIdForAccount).toHaveBeenCalledWith(7, me);
    expect(hotelsService.updateHotel).toHaveBeenCalledWith(7, { name: 'x' }, me);
  });

  it.each([
    ['delete', (c: HotelsController, me: any) => c.delete('7', me), 'deleteHotel'],
    ['deleteBrand', (c: HotelsController, me: any) => c.deleteBrand('7', me), 'deleteBrand'],
    ['revokeStaff', (c: HotelsController, me: any) => c.revokeStaff('7', '8', me), 'revokeStaffAccess'],
    ['revokeAccess', (c: HotelsController, me: any) => c.revokeAccess('7', '8', me), 'revokeAccess'],
  ])('%s answers success with no data', async (_name, call, method) => {
    await expect(call(controller, admin())).resolves.toMatchObject({ success: true });
    expect(hotelsService[method]).toHaveBeenCalled();
  });

  it.each([
    ['listStaff', (c: HotelsController, me: any) => c.listStaff('7', me)],
    ['addStaff', (c: HotelsController, me: any) => c.addStaff('7', loose({ email: 'a@x' }), me)],
    ['updateStaffStatus', (c: HotelsController, me: any) => c.updateStaffStatus('7', '8', loose({ status: 'active' }), me)],
    ['importStaffCsv', (c: HotelsController, me: any) => c.importStaffCsv('7', loose({ csvContent: '' }), me)],
  ])('%s wraps the result with a message', async (_name, call) => {
    await expect(call(controller, owner())).resolves.toMatchObject({ success: true, message: expect.any(String) });
  });

  it('serves the sample csv only to someone who may list the members', async () => {
    hotelsService.getMembersSampleCsv.mockReturnValue({ content: 'email,name,role' });
    await expect(controller.getMembersSampleCsv('7', owner())).resolves.toMatchObject({ data: { content: 'email,name,role' } });
    hotelsService.listStaffForHotel.mockRejectedValue(new ForbiddenException());
    await expect(controller.getMembersSampleCsv('7', staff())).rejects.toThrow(ForbiddenException);
  });

  describe('onboarding', () => {
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

    it.each([
      ['staff', staff],
      ['guest', guest],
    ])('refuses %s before any lookup', async (_name, who) => {
      await expect(controller.search('taj', who())).rejects.toThrow(ForbiddenException);
      await expect(controller.analyze('p', who())).rejects.toThrow(ForbiddenException);
      await expect(controller.extract({ placeId: 'p' }, who())).rejects.toThrow(ForbiddenException);
      expect(maps.searchPlaces).not.toHaveBeenCalled();
      expect(onboarding.analyzePlace).not.toHaveBeenCalled();
      expect(onboarding.crawlAndExtract).not.toHaveBeenCalled();
    });

    // finalize skips the gate, so a staff member or guest can overwrite the hotel at an address — see test/README.md.
    it.failing('refuses staff finalizing an onboarding', async () => {
      await expect(controller.finalize({ address: 'x' }, staff())).rejects.toThrow(ForbiddenException);
    });
  });
});
