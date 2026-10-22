import { BadRequestException } from '@nestjs/common';
import { HotelsService } from '../../../src/hotels/hotels.service';
import { HotelMemberStatus, HOTEL_IMAGES_MAX_COUNT } from '../../../src/common/constants/constants.service';
import { AccountRole } from '../../../src/accounts/accounts.model';
import { mock, constants, admin, owner, staff, guest, row, loose } from '../helpers';

describe('HotelsService', () => {
  let hotels: any, hotelAccounts: any, bookings: any, bookingsService: any, accountsService: any, aws: any;
  let service: HotelsService;

  beforeEach(() => {
    hotels = mock();
    hotelAccounts = mock({ findOne: jest.fn(async () => row({ status: HotelMemberStatus.ACTIVE })) });
    bookings = mock();
    bookingsService = mock();
    accountsService = mock();
    aws = mock();
    const mailer = mock({ buildBaseEmailHtml: jest.fn((html: string) => html) });
    service = new HotelsService(hotels, hotelAccounts, mock(), bookings, bookingsService, accountsService, mock(), mailer, constants, aws);
  });

  it('scopes a guest to the hotels of their bookings, once each', async () => {
    bookings.findAll.mockResolvedValue([{ hotelId: 1 }, { hotelId: 1 }, { hotelId: 2 }]);
    hotels.findAll.mockResolvedValue([]);
    await service.findAllForAccount(guest());
    expect(hotels.findAll.mock.calls[0][0].where.id).toEqual([1, 2]);
  });

  it('matches no hotel for an account with none, rather than every hotel', async () => {
    hotelAccounts.findAll.mockResolvedValue([]);
    hotels.findAll.mockResolvedValue([]);
    await service.findAllForAccount(owner());
    expect(hotels.findAll.mock.calls[0][0].where.id).toBe(-1);
  });

  it('deleteHotel rolls back and rethrows when a step fails', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    hotels.sequelize = { transaction: jest.fn(async () => transaction) };
    hotels.findByPk.mockResolvedValue({ id: 1 });
    const failure = new Error('boom');
    bookingsService.deleteBooking.mockRejectedValue(failure);
    await expect(service.deleteHotel(1, admin())).rejects.toBe(failure);
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  describe('members', () => {
    beforeEach(() => hotels.findByPk.mockResolvedValue({ id: 1, name: 'Grand' }));
    const body = { email: 'new@x', name: 'New', role: AccountRole.HOTEL_STAFF };

    it('re-invites an existing member, resetting them to pending with the new role', async () => {
      const membership = row({ role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.DISABLED });
      accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2, email: 'a@x', role: AccountRole.GUEST }, created: false });
      hotelAccounts.findOrCreate.mockResolvedValue([membership, false]);
      await service.addStaffByEmail(1, loose({ ...body, role: AccountRole.HOTEL_OWNER }), admin());
      expect(accountsService.update).toHaveBeenCalledWith({ role: AccountRole.HOTEL_OWNER }, { id: 2 });
      expect(membership).toMatchObject({ role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.PENDING });
    });

    it('never changes the role of an existing admin', async () => {
      accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2, email: 'a@x', role: AccountRole.ADMIN }, created: false });
      hotelAccounts.findOrCreate.mockResolvedValue([row(), true]);
      await service.addStaffByEmail(1, loose(body), admin());
      expect(accountsService.update).not.toHaveBeenCalled();
    });

    it('imports each csv row, normalised, and reports the ones that fail', async () => {
      const add = jest.spyOn(service, 'addStaffByEmail').mockResolvedValueOnce(loose({})).mockRejectedValueOnce(new Error('nope'));
      const csv = 'email,name,role\nA@X.com, Alice ,hotel_staff\nb@x.com,Bob,HOTEL_OWNER\n';
      await expect(service.importMembersCsv(1, loose({ csvContent: csv }), admin())).resolves.toEqual({ imported: 1, failed: 1, failures: ['Row 3: nope'] });
      expect(add.mock.calls[0][1]).toEqual({ email: 'a@x.com', name: 'Alice', role: AccountRole.HOTEL_STAFF });
      expect(add.mock.calls[1][1]).toEqual({ email: 'b@x.com', name: 'Bob', role: AccountRole.HOTEL_OWNER });
    });

    it.each([
      ['a@x,Alice', 'Role must be hotel_staff or hotel_owner'],
      ['a@x,Alice,guest', 'Role must be hotel_staff or hotel_owner'],
      [' ,Alice,hotel_staff', 'Email is required'],
    ])('refuses the csv row %p', async (csvContent, message) => {
      await expect(service.importMembersCsv(1, loose({ csvContent }), admin())).rejects.toThrow(new BadRequestException(message));
    });
  });

  it.each([
    [AccountRole.HOTEL_OWNER, AccountRole.HOTEL_OWNER],
    [AccountRole.GUEST, AccountRole.HOTEL_STAFF],
  ])('grantAccess gives a %s account %s access, active', async (accountRole, memberRole) => {
    const membership = row({ status: HotelMemberStatus.DISABLED });
    hotels.findByPk.mockResolvedValue({ id: 1 });
    accountsService.findOne.mockResolvedValue({ id: 2, role: accountRole });
    hotelAccounts.findOrCreate.mockResolvedValue([membership, false]);
    await service.grantAccess(1, loose({ accountId: 2 }));
    expect(membership).toMatchObject({ role: memberRole, status: HotelMemberStatus.ACTIVE });
  });

  describe('images and tone', () => {
    const url = 'https://bucket.s3.ap-south-1.amazonaws.com/samantha/hotel-images/a.png';
    beforeEach(() => hotels.update.mockImplementation(async (changes: any) => [1, [{ id: 1, ...changes }]]));

    it('refuses an image past the limit', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, images: Array(HOTEL_IMAGES_MAX_COUNT).fill(url) });
      await expect(service.confirmImageUpload(1, { s3Url: 'https://new' }, staff())).rejects.toThrow(new BadRequestException(`A hotel can have at most ${HOTEL_IMAGES_MAX_COUNT} images`));
    });

    // Known problem (test/README.md): any S3 key the url names is deleted. Drop `.failing` once fixed.
    it.failing('deleteImage leaves S3 alone for a url that is not one of the hotel images', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, images: [url] });
      await service.deleteImage(1, { s3Url: 'https://bucket.s3.amazonaws.com/other-hotel/secret.png' }, staff());
      expect(aws.deleteObject).not.toHaveBeenCalled();
    });

    it.each([['none'], ['not-a-url']])('falls back to the built-in tone for %p', async (customToneUrl) => {
      hotels.findOne.mockResolvedValue({ id: 1, customToneUrl });
      await expect(service.getNotificationToneSignedUrl(1, staff())).resolves.toEqual({ signedUrl: null, isBuiltIn: true, builtInPath: '/assets/tones/gentle_chime.mp3' });
    });

    it('signs a custom tone by its S3 key', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, customToneUrl: url });
      aws.getSignedUrl.mockResolvedValue('https://signed');
      await expect(service.getNotificationToneSignedUrl(1, staff())).resolves.toEqual({ signedUrl: 'https://signed', isBuiltIn: false });
      expect(aws.getSignedUrl).toHaveBeenCalledWith('samantha/hotel-images/a.png', 86400, false);
    });

    it('reports a tone signing failure as BadRequest', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, customToneUrl: url });
      aws.getSignedUrl.mockRejectedValue(new Error('denied'));
      await expect(service.getNotificationToneSignedUrl(1, staff())).rejects.toThrow(new BadRequestException('Failed to generate signed URL: denied'));
    });
  });
});
