import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HotelsService } from '../../../src/hotels/hotels.service';
import { HotelMemberStatus, HOTEL_IMAGES_MAX_COUNT, NotificationTone } from '../../../src/common/constants/constants.service';
import { AccountRole } from '../../../src/accounts/accounts.model';
import { Notification } from '../../../src/notifications/notifications.model';
import { Cost } from '../../../src/costs/costs.model';
import { HotelIntegration } from '../../../src/integrations/hotel-integrations.model';
import { RoomType } from '../../../src/rooms/room-types.model';
import { RoomInventory } from '../../../src/rooms/room-inventory.model';
import { Room } from '../../../src/rooms/rooms.model';
import { MenuItem } from '../../../src/restaurant/restaurant.model';
import { mock, constants, admin, owner, staff, guest, row, loose } from '../helpers';

describe('HotelsService', () => {
  let hotels: any, hotelAccounts: any, brands: any, bookings: any, bookingsService: any, accountsService: any, authService: any, mailer: any, aws: any;
  let service: HotelsService;
  const member = row({ hotelId: 1, accountId: 1, status: HotelMemberStatus.ACTIVE });

  beforeEach(() => {
    hotels = mock();
    hotelAccounts = mock();
    brands = mock();
    bookings = mock();
    bookingsService = mock();
    accountsService = mock();
    authService = mock({ generateInviteToken: jest.fn(async () => 'invite-token') });
    mailer = mock({ buildBaseEmailHtml: jest.fn((html: string) => html) });
    aws = mock({ createUploadUrl: jest.fn(async (opts: any) => ({ key: opts.key, url: 'https://upload' })), deleteObject: jest.fn(async () => undefined) });
    service = new HotelsService(hotels, hotelAccounts, brands, bookings, bookingsService, accountsService, authService, mailer, constants, aws);
  });

  /** The account is an active member of hotel 1 (or not, with `null`). */
  const memberOf = (value: any = member) => hotelAccounts.findOne.mockResolvedValue(value);

  describe('createHotel', () => {
    it('lets an admin create a hotel without adding membership', async () => {
      hotels.create.mockResolvedValue({ id: 7 });
      await expect(service.createHotel(loose({ name: 'H' }), admin())).resolves.toEqual({ id: 7 });
      expect(hotelAccounts.create).not.toHaveBeenCalled();
    });

    it('makes an owner an active owner of the hotel they create', async () => {
      const me = owner();
      hotels.create.mockResolvedValue({ id: 7 });
      await service.createHotel(loose({ name: 'H' }), me);
      expect(hotelAccounts.create).toHaveBeenCalledWith({ hotelId: 7, accountId: me.id, role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.ACTIVE });
    });

    it.each([
      ['staff', staff],
      ['guest', guest],
    ])('refuses %s', async (_name, who) => {
      await expect(service.createHotel(loose({ name: 'H' }), who())).rejects.toThrow(ForbiddenException);
      expect(hotels.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllForAccount', () => {
    const hotel = (openRequestsCount: string) => ({ get: () => openRequestsCount });

    it('gives an admin every hotel and totals the open requests', async () => {
      hotels.findAll.mockResolvedValue([hotel('2'), hotel('3')]);
      const res = await service.findAllForAccount(admin());
      expect(hotels.findAll.mock.calls[0][0].where).toEqual({});
      expect(res).toMatchObject({ success: true, meta: { totalOpenRequests: 5 } });
    });

    it('scopes a guest to the hotels of their bookings, once each', async () => {
      bookings.findAll.mockResolvedValue([{ hotelId: 1 }, { hotelId: 1 }, { hotelId: 2 }]);
      hotels.findAll.mockResolvedValue([]);
      await service.findAllForAccount(guest());
      expect(hotels.findAll.mock.calls[0][0].where.id).toEqual([1, 2]);
    });

    it('scopes staff to hotels they are an active member of', async () => {
      hotelAccounts.findAll.mockResolvedValue([{ hotelId: 4 }]);
      hotels.findAll.mockResolvedValue([]);
      await service.findAllForAccount(staff());
      expect(hotelAccounts.findAll.mock.calls[0][0].where.status).toBe(HotelMemberStatus.ACTIVE);
      expect(hotels.findAll.mock.calls[0][0].where.id).toEqual([4]);
    });

    it('matches nothing for an account with no hotels', async () => {
      hotelAccounts.findAll.mockResolvedValue([]);
      hotels.findAll.mockResolvedValue([]);
      await service.findAllForAccount(owner());
      expect(hotels.findAll.mock.calls[0][0].where.id).toBe(-1);
    });

    it('caps the limit at the agent maximum', async () => {
      hotels.findAll.mockResolvedValue([]);
      await service.findAllForAccount(admin(), loose({ limit: 10_000 }));
      expect(hotels.findAll.mock.calls[0][0].limit).toBe(constants.private.AGENT_HOTELS_MAX_LIMIT);
    });

    it('rejects an unknown query parameter', async () => {
      await expect(service.findAllForAccount(admin(), loose({ nope: 'x' }))).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByIdForAccount', () => {
    it('returns the hotel to an admin without a membership check', async () => {
      hotels.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findByIdForAccount(1, admin())).resolves.toEqual({ id: 1 });
      expect(hotelAccounts.findOne).not.toHaveBeenCalled();
    });

    it('returns the hotel to an active member', async () => {
      memberOf();
      hotels.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findByIdForAccount(1, staff())).resolves.toEqual({ id: 1 });
    });

    it('hides the hotel from a non-member as NotFound', async () => {
      memberOf(null);
      await expect(service.findByIdForAccount(1, guest())).rejects.toThrow(NotFoundException);
      expect(hotels.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFound when the hotel does not exist', async () => {
      hotels.findOne.mockResolvedValue(null);
      await expect(service.findByIdForAccount(1, admin())).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns the hotel', async () => {
      hotels.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findById(1)).resolves.toEqual({ id: 1 });
    });

    it('throws NotFound', async () => {
      hotels.findOne.mockResolvedValue(null);
      await expect(service.findById(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAccessibleHotelIds', () => {
    it('is unrestricted (null) for an admin', async () => {
      await expect(service.getAccessibleHotelIds(admin())).resolves.toBeNull();
    });

    it('is the de-duplicated booking hotels for a guest', async () => {
      bookings.findAll.mockResolvedValue([{ hotelId: 3 }, { hotelId: 3 }]);
      await expect(service.getAccessibleHotelIds(guest())).resolves.toEqual([3]);
    });

    it('is the active memberships for staff', async () => {
      hotelAccounts.findAll.mockResolvedValue([{ hotelId: 5 }, { hotelId: 6 }, { hotelId: 5 }]);
      await expect(service.getAccessibleHotelIds(staff())).resolves.toEqual([5, 6]);
    });
  });

  describe('deleteHotel', () => {
    let transaction: any;
    const models = [Notification, Cost, HotelIntegration, RoomInventory, Room, RoomType, MenuItem];

    beforeEach(() => {
      transaction = { commit: jest.fn(), rollback: jest.fn() };
      hotels.sequelize = { transaction: jest.fn(async () => transaction) };
      hotels.findByPk.mockResolvedValue({ id: 1 });
      for (const model of models) jest.spyOn(model, 'destroy').mockResolvedValue(loose(0));
      jest.spyOn(RoomType, 'findAll').mockResolvedValue(loose([{ id: 11 }]));
    });

    afterEach(() => jest.restoreAllMocks());

    it('removes the hotel and everything under it in one transaction', async () => {
      await service.deleteHotel(1, admin());
      expect(bookingsService.deleteBooking).toHaveBeenCalledWith({ hotelId: 1 }, transaction, false);
      for (const model of models) expect(model.destroy).toHaveBeenCalled();
      expect(hotelAccounts.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { hotelId: 1 }, transaction }));
      expect(hotels.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 }, transaction }));
      expect(transaction.commit).toHaveBeenCalled();
    });

    it('rolls back and rethrows when a step fails', async () => {
      const failure = new Error('boom');
      bookingsService.deleteBooking.mockRejectedValue(failure);
      await expect(service.deleteHotel(1, admin())).rejects.toBe(failure);
      expect(transaction.rollback).toHaveBeenCalled();
      expect(transaction.commit).not.toHaveBeenCalled();
    });

    it.each([
      ['owner', owner],
      ['staff', staff],
      ['guest', guest],
    ])('refuses %s', async (_name, who) => {
      await expect(service.deleteHotel(1, who())).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for a missing hotel', async () => {
      hotels.findByPk.mockResolvedValue(null);
      await expect(service.deleteHotel(1, admin())).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when there is no database connection', async () => {
      hotels.sequelize = null;
      await expect(service.deleteHotel(1, admin())).rejects.toThrow(new BadRequestException('Database connection is unavailable'));
    });
  });

  describe('deleteBrand', () => {
    it('deletes every hotel of the brand, then the brand', async () => {
      const me = admin();
      brands.findByPk.mockResolvedValue({ id: 9 });
      hotels.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const deleteHotel = jest.spyOn(service, 'deleteHotel').mockResolvedValue();
      await service.deleteBrand(9, me);
      expect(deleteHotel.mock.calls).toEqual([
        [1, me],
        [2, me],
      ]);
      expect(brands.destroy).toHaveBeenCalledWith({ where: { id: 9 } });
    });

    it('refuses a non-admin', async () => {
      await expect(service.deleteBrand(9, owner())).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for a missing brand', async () => {
      brands.findByPk.mockResolvedValue(null);
      await expect(service.deleteBrand(9, admin())).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateHotel', () => {
    it('updates for an active member', async () => {
      memberOf();
      hotels.update.mockResolvedValue([1, [{ id: 1, name: 'New' }]]);
      await expect(service.updateHotel(1, loose({ name: 'New' }), staff())).resolves.toEqual({ id: 1, name: 'New' });
    });

    it('refuses a non-member', async () => {
      memberOf(null);
      await expect(service.updateHotel(1, loose({}), owner())).rejects.toThrow(ForbiddenException);
      expect(hotels.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when nothing was updated', async () => {
      hotels.update.mockResolvedValue([0, []]);
      await expect(service.updateHotel(1, loose({}), admin())).rejects.toThrow(NotFoundException);
    });
  });

  describe('ensureCanManageHotelSettings', () => {
    it('allows an admin', async () => {
      hotels.findByPk.mockResolvedValue({ id: 1 });
      await expect(service.ensureCanManageHotelSettings(1, admin())).resolves.toEqual({ id: 1 });
    });

    it('allows an owner who is an active member', async () => {
      hotels.findByPk.mockResolvedValue({ id: 1 });
      memberOf();
      await expect(service.ensureCanManageHotelSettings(1, owner())).resolves.toEqual({ id: 1 });
    });

    it('refuses an owner of another hotel', async () => {
      hotels.findByPk.mockResolvedValue({ id: 1 });
      memberOf(null);
      await expect(service.ensureCanManageHotelSettings(1, owner())).rejects.toThrow(ForbiddenException);
    });

    it.each([
      ['staff', staff],
      ['guest', guest],
    ])('refuses %s even as a member', async (_name, who) => {
      hotels.findByPk.mockResolvedValue({ id: 1 });
      memberOf();
      await expect(service.ensureCanManageHotelSettings(1, who())).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for a missing hotel', async () => {
      hotels.findByPk.mockResolvedValue(null);
      await expect(service.ensureCanManageHotelSettings(1, admin())).rejects.toThrow(NotFoundException);
    });
  });

  describe('members', () => {
    beforeEach(() => hotels.findByPk.mockResolvedValue({ id: 1, name: 'Grand' }));

    it('lists members with their role and status', async () => {
      hotelAccounts.findAll.mockResolvedValue([{ role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.PENDING, account: { id: 2, name: 'A', email: 'a@x' } }]);
      await expect(service.listStaffForHotel(1, admin())).resolves.toEqual([{ id: 2, name: 'A', email: 'a@x', role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.PENDING }]);
    });

    it('listing is refused to staff', async () => {
      await expect(service.listStaffForHotel(1, staff())).rejects.toThrow(ForbiddenException);
    });

    describe('addStaffByEmail', () => {
      const body = { email: 'new@x', name: 'New', role: AccountRole.HOTEL_STAFF };

      it('creates the account, a pending membership, and emails an invite', async () => {
        accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2, email: 'new@x', name: 'New' }, created: true });
        hotelAccounts.findOrCreate.mockResolvedValue([row(), true]);
        const res = await service.addStaffByEmail(1, loose(body), admin());
        expect(res).toEqual({ id: 2, name: 'New', email: 'new@x', role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.PENDING });
        expect(authService.generateInviteToken).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), { hotelId: 1, type: expect.any(String) });
        expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new@x', text: expect.stringContaining('invite?token=invite-token') }));
      });

      it('re-invites an existing member and resets them to pending with the new role', async () => {
        const membership = row({ role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.DISABLED });
        accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2, email: 'a@x', role: AccountRole.GUEST }, created: false });
        hotelAccounts.findOrCreate.mockResolvedValue([membership, false]);
        await service.addStaffByEmail(1, loose({ ...body, role: AccountRole.HOTEL_OWNER }), admin());
        expect(accountsService.update).toHaveBeenCalledWith({ role: AccountRole.HOTEL_OWNER }, { id: 2 });
        expect(membership).toMatchObject({ role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.PENDING });
        expect(membership.save).toHaveBeenCalled();
      });

      it('never changes the role of an existing admin', async () => {
        accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2, email: 'a@x', role: AccountRole.ADMIN }, created: false });
        hotelAccounts.findOrCreate.mockResolvedValue([row(), true]);
        await service.addStaffByEmail(1, loose(body), admin());
        expect(accountsService.update).not.toHaveBeenCalled();
      });

      it('sends no email to an account without one', async () => {
        accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 2 }, created: true });
        hotelAccounts.findOrCreate.mockResolvedValue([row(), true]);
        await service.addStaffByEmail(1, loose(body), admin());
        expect(mailer.sendMail).not.toHaveBeenCalled();
      });

      it('is refused to staff', async () => {
        await expect(service.addStaffByEmail(1, loose(body), staff())).rejects.toThrow(ForbiddenException);
        expect(accountsService.findOrCreateByEmail).not.toHaveBeenCalled();
      });
    });

    describe('updateStaffMemberStatus', () => {
      it.each([HotelMemberStatus.ACTIVE, HotelMemberStatus.DISABLED])('sets %s', async (status) => {
        const membership = row({ role: AccountRole.HOTEL_STAFF, status: HotelMemberStatus.PENDING, account: { id: 2, name: 'A', email: 'a@x' } });
        memberOf(membership);
        await expect(service.updateStaffMemberStatus(1, 2, loose({ status }), admin())).resolves.toMatchObject({ id: 2, status });
        expect(membership.save).toHaveBeenCalled();
      });

      it('refuses to set pending by hand', async () => {
        await expect(service.updateStaffMemberStatus(1, 2, loose({ status: HotelMemberStatus.PENDING }), admin())).rejects.toThrow(
          new BadRequestException('Only active and disabled statuses can be set manually'),
        );
      });

      it('throws NotFound for someone who is not a member', async () => {
        memberOf(null);
        await expect(service.updateStaffMemberStatus(1, 2, loose({ status: HotelMemberStatus.ACTIVE }), admin())).rejects.toThrow(new NotFoundException('Member not found for this hotel'));
      });

      it('revokeStaffAccess disables the member', async () => {
        const update = jest.spyOn(service, 'updateStaffMemberStatus').mockResolvedValue(loose({}));
        const me = admin();
        await service.revokeStaffAccess(1, 2, me);
        expect(update).toHaveBeenCalledWith(1, 2, { status: HotelMemberStatus.DISABLED }, me);
      });
    });

    describe('importMembersCsv', () => {
      it('imports each row and reports the ones that fail', async () => {
        const add = jest.spyOn(service, 'addStaffByEmail').mockResolvedValueOnce(loose({})).mockRejectedValueOnce(new Error('nope'));
        const csv = 'email,name,role\nA@X.com, Alice ,hotel_staff\nb@x.com,Bob,HOTEL_OWNER\n';
        await expect(service.importMembersCsv(1, loose({ csvContent: csv }), admin())).resolves.toEqual({ imported: 1, failed: 1, failures: ['Row 3: nope'] });
        expect(add.mock.calls[0][1]).toEqual({ email: 'a@x.com', name: 'Alice', role: AccountRole.HOTEL_STAFF });
        expect(add.mock.calls[1][1]).toEqual({ email: 'b@x.com', name: 'Bob', role: AccountRole.HOTEL_OWNER });
      });

      it.each([
        ['empty', ''],
        ['header only', 'email,name,role\n'],
      ])('refuses an %s file', async (_name, csvContent) => {
        await expect(service.importMembersCsv(1, loose({ csvContent }), admin())).rejects.toThrow(new BadRequestException('No rows found in csv'));
      });

      it.each([
        ['too few columns', 'a@x,Alice'],
        ['an unknown role', 'a@x,Alice,guest'],
      ])('refuses a row with %s', async (_name, csvContent) => {
        await expect(service.importMembersCsv(1, loose({ csvContent }), admin())).rejects.toThrow(new BadRequestException('Role must be hotel_staff or hotel_owner'));
      });

      it('refuses a row without an email', async () => {
        await expect(service.importMembersCsv(1, loose({ csvContent: ' ,Alice,hotel_staff' }), admin())).rejects.toThrow(new BadRequestException('Email is required'));
      });

      it('is refused to staff', async () => {
        await expect(service.importMembersCsv(1, loose({ csvContent: 'a@x,A,hotel_staff' }), staff())).rejects.toThrow(ForbiddenException);
      });
    });

    it('sample csv starts with the header the importer skips', () => {
      expect(service.getMembersSampleCsv().content.split('\n')[0]).toBe('email,name,role');
    });
  });

  describe('markMemberActiveForInvite', () => {
    it('activates the membership named by a staff invite', async () => {
      const membership = row({ status: HotelMemberStatus.PENDING });
      memberOf(membership);
      await service.markMemberActiveForInvite(2, 1, 'staff');
      expect(membership.status).toBe(HotelMemberStatus.ACTIVE);
      expect(membership.save).toHaveBeenCalled();
    });

    it.each([
      [undefined, 'staff'],
      [1, 'other'],
    ])('ignores hotel %p / type %p', async (hotelId, type) => {
      await service.markMemberActiveForInvite(2, hotelId, type);
      expect(hotelAccounts.findOne).not.toHaveBeenCalled();
    });

    it('does nothing when there is no membership', async () => {
      memberOf(null);
      await expect(service.markMemberActiveForInvite(2, 1, 'staff')).resolves.toBeUndefined();
    });
  });

  describe('grantAccess / revokeAccess', () => {
    it('grants an owner account owner access, active', async () => {
      const membership = row({ status: HotelMemberStatus.DISABLED });
      hotels.findByPk.mockResolvedValue({ id: 1 });
      accountsService.findOne.mockResolvedValue({ id: 2, role: AccountRole.HOTEL_OWNER });
      hotelAccounts.findOrCreate.mockResolvedValue([membership, false]);
      await service.grantAccess(1, loose({ accountId: 2 }));
      expect(membership).toMatchObject({ role: AccountRole.HOTEL_OWNER, status: HotelMemberStatus.ACTIVE });
    });

    it('grants any other account staff access', async () => {
      const membership = row({ status: HotelMemberStatus.ACTIVE });
      hotels.findByPk.mockResolvedValue({ id: 1 });
      accountsService.findOne.mockResolvedValue({ id: 2, role: AccountRole.GUEST });
      hotelAccounts.findOrCreate.mockResolvedValue([membership, true]);
      await service.grantAccess(1, loose({ accountId: 2 }));
      expect(membership.role).toBe(AccountRole.HOTEL_STAFF);
    });

    it('throws NotFound for a missing hotel', async () => {
      hotels.findByPk.mockResolvedValue(null);
      await expect(service.grantAccess(1, loose({ accountId: 2 }))).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound for a missing account', async () => {
      hotels.findByPk.mockResolvedValue({ id: 1 });
      accountsService.findOne.mockResolvedValue(null);
      await expect(service.grantAccess(1, loose({ accountId: 2 }))).rejects.toThrow(NotFoundException);
    });

    it('revokeAccess removes the membership', async () => {
      await service.revokeAccess(1, 2);
      expect(hotelAccounts.destroy).toHaveBeenCalledWith({ where: { hotelId: 1, accountId: 2 } });
    });
  });

  describe('uploads', () => {
    const file = { fileName: 'a.png', fileSize: 10, contentType: 'image/png' };
    const url = 'https://bucket.s3.ap-south-1.amazonaws.com/samantha/hotel-images/a.png';

    beforeEach(() => {
      memberOf();
      hotels.findOne.mockResolvedValue({ id: 1, images: [url] });
      hotels.update.mockImplementation(async (changes: any) => [1, [{ id: 1, ...changes }]]);
    });

    it.each([
      ['getLogoPresignedUrl', 'hotel-logos/', 'image', true],
      ['getImagesPresignedUrl', 'hotel-images/', 'image', true],
      ['getNotificationTonePresignedUrl', 'notification-tones/', 'audio', false],
    ])('%s returns an upload url under %s', async (method, folder, allowedType, isPublic) => {
      const res = await loose(service)[method](1, file, staff());
      expect(res.success).toBe(true);
      expect(aws.createUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ key: expect.stringContaining(folder), allowedType, isPublic }));
    });

    it.each([
      'getLogoPresignedUrl',
      'getImagesPresignedUrl',
      'getNotificationTonePresignedUrl',
      'confirmLogoUpload',
      'confirmImageUpload',
      'deleteImage',
      'reorderImages',
      'confirmNotificationToneUpload',
      'getNotificationToneSignedUrl',
    ])('%s hides the hotel from a non-member', async (method) => {
      memberOf(null);
      await expect(loose(service)[method](1, { ...file, s3Url: url, images: [url] }, guest())).rejects.toThrow(NotFoundException);
      expect(hotels.update).not.toHaveBeenCalled();
    });

    it('confirmLogoUpload stores the logo url', async () => {
      await expect(service.confirmLogoUpload(1, { s3Url: url }, staff())).resolves.toMatchObject({ success: true, data: { logoUrl: url } });
    });

    it('confirmImageUpload appends the image', async () => {
      const res = await service.confirmImageUpload(1, { s3Url: 'https://new' }, staff());
      expect(res.data.images).toEqual([url, 'https://new']);
    });

    it('confirmImageUpload refuses past the image limit', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, images: Array(HOTEL_IMAGES_MAX_COUNT).fill(url) });
      await expect(service.confirmImageUpload(1, { s3Url: 'https://new' }, staff())).rejects.toThrow(new BadRequestException(`A hotel can have at most ${HOTEL_IMAGES_MAX_COUNT} images`));
    });

    it('deleteImage drops the url and deletes the S3 object, even if S3 fails', async () => {
      aws.deleteObject.mockRejectedValue(new Error('s3 down'));
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const res = await service.deleteImage(1, { s3Url: url }, staff());
      expect(res.data.images).toEqual([]);
      expect(aws.deleteObject).toHaveBeenCalledWith('samantha/hotel-images/a.png');
    });

    // Known problem (test/README.md): any S3 key the url names is deleted. Drop `.failing` once fixed.
    it.failing('deleteImage leaves S3 alone for a url that is not one of the hotel images', async () => {
      await service.deleteImage(1, { s3Url: 'https://bucket.s3.amazonaws.com/other-hotel/secret.png' }, staff());
      expect(aws.deleteObject).not.toHaveBeenCalled();
    });

    it('reorderImages saves the new order', async () => {
      hotels.findOne.mockResolvedValue({ id: 1, images: ['a', 'b'] });
      await expect(service.reorderImages(1, { images: ['b', 'a'] }, staff())).resolves.toMatchObject({ data: { images: ['b', 'a'] } });
    });

    it.each([[['a']], [['a', 'c']], [['a', 'b', 'c']]])('reorderImages refuses a list that is not a permutation (%p)', async (images) => {
      hotels.findOne.mockResolvedValue({ id: 1, images: ['a', 'b'] });
      await expect(service.reorderImages(1, { images }, staff())).rejects.toThrow(new BadRequestException('Invalid image list'));
    });

    it('confirmNotificationToneUpload switches the hotel to the custom tone', async () => {
      const res = await service.confirmNotificationToneUpload(1, { s3Url: url }, staff());
      expect(res.data).toMatchObject({ customToneUrl: url, notificationTone: NotificationTone.CUSTOM });
    });

    it('confirmNotificationToneUpload reports a failed update as BadRequest', async () => {
      hotels.update.mockResolvedValue([0, []]);
      await expect(service.confirmNotificationToneUpload(1, { s3Url: url }, staff())).rejects.toThrow(BadRequestException);
    });

    describe('getNotificationToneSignedUrl', () => {
      const withTone = (customToneUrl: any) => hotels.findOne.mockResolvedValue({ id: 1, customToneUrl });

      it.each([[null], ['none'], ['not-a-url']])('falls back to the gentle chime for %p', async (tone) => {
        withTone(tone);
        await expect(service.getNotificationToneSignedUrl(1, staff())).resolves.toEqual({ signedUrl: null, isBuiltIn: true, builtInPath: '/assets/tones/gentle_chime.mp3' });
      });

      it('returns the built-in path for a built-in tone name', async () => {
        withTone('alert_sound');
        await expect(service.getNotificationToneSignedUrl(1, staff())).resolves.toMatchObject({ builtInPath: '/assets/tones/alert_sound.mp3' });
      });

      it('signs an S3 url by its key', async () => {
        withTone(url);
        aws.getSignedUrl.mockResolvedValue('https://signed');
        await expect(service.getNotificationToneSignedUrl(1, staff())).resolves.toEqual({ signedUrl: 'https://signed', isBuiltIn: false });
        expect(aws.getSignedUrl).toHaveBeenCalledWith('samantha/hotel-images/a.png', 86400, false);
      });

      it('reports a signing failure as BadRequest', async () => {
        withTone(url);
        aws.getSignedUrl.mockRejectedValue(new Error('denied'));
        await expect(service.getNotificationToneSignedUrl(1, staff())).rejects.toThrow(new BadRequestException('Failed to generate signed URL: denied'));
      });
    });
  });

  it('getListFilterMeta wraps the filters in the standard response', () => {
    expect(service.getListFilterMeta()).toMatchObject({ success: true, data: expect.any(Object) });
  });
});
