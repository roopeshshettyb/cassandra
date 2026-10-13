import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OrganisationsService } from '../../../src/organisations/organisations.service';
import { AccountRole } from '../../../src/common/constants/constants.service';
import { mock, constants, admin, owner, staff, guest, loose } from '../helpers';

describe('OrganisationsService', () => {
  let organisations: any, accountsService: any;
  let service: OrganisationsService;
  const O = constants.private.ORGANISATIONS;
  const U = O.USERS;
  const org = (id: number, name = `Org ${id}`) => ({ id, name, toJSON: () => ({ id, name }) });

  beforeEach(() => {
    organisations = mock({ create: jest.fn(async (v: any) => ({ id: 1, ...v })) });
    accountsService = mock({ countByOrganisation: jest.fn(async () => ({ 1: 4 })), count: jest.fn(async () => ({ count: 0 })) });
    service = new OrganisationsService(organisations, accountsService, constants);
  });

  /** A token issued before organisationId was added to the payload. */
  const staleOwner = () => {
    const me = owner();
    delete me.organisationId;
    return me;
  };

  describe('findAllForAccount', () => {
    it('lists every organisation with member counts for an admin', async () => {
      organisations.findAll.mockResolvedValue([org(1), org(2)]);
      const res = await service.findAllForAccount(admin(), 'org');
      expect(res.data).toEqual([
        { id: 1, name: 'Org 1', memberCount: 4 },
        { id: 2, name: 'Org 2', memberCount: 0 },
      ]);
    });

    it('narrows an owner to their own organisation', async () => {
      organisations.findAll.mockResolvedValue([org(1)]);
      await service.findAllForAccount(owner({ organisationId: 1 }));
      expect(organisations.findAll.mock.calls[0][0].where).toEqual({ id: 1 });
    });

    it('shows a guest nothing', async () => {
      await expect(service.findAllForAccount(guest({ organisationId: null }))).resolves.toMatchObject({ data: [] });
      expect(organisations.findAll).not.toHaveBeenCalled();
    });

    it('refuses a stale session', async () => {
      await expect(service.findAllForAccount(staleOwner())).rejects.toThrow(new UnauthorizedException(U.ERROR_STALE_SESSION));
    });
  });

  describe('findByIdForAccount', () => {
    it('returns an owner their own organisation', async () => {
      organisations.findOne.mockResolvedValue(org(1));
      await expect(service.findByIdForAccount(1, owner({ organisationId: 1 }))).resolves.toMatchObject({ id: 1 });
    });

    it('hides another organisation as NotFound', async () => {
      organisations.findOne.mockResolvedValue(org(2));
      await expect(service.findByIdForAccount(2, owner({ organisationId: 1 }))).rejects.toThrow(new NotFoundException(O.ERROR_NOT_FOUND));
    });

    it('throws NotFound for a missing one', async () => {
      organisations.findOne.mockResolvedValue(null);
      await expect(service.findByIdForAccount(2, admin())).rejects.toThrow(new NotFoundException(O.ERROR_NOT_FOUND));
    });
  });

  describe('create / update / delete', () => {
    it('creates with the name trimmed', async () => {
      organisations.findOne.mockResolvedValue(null);
      await expect(service.create(loose({ name: ' Acme ' }))).resolves.toMatchObject({ message: O.MSG_CREATED, data: { name: 'Acme', description: null } });
    });

    it('refuses a name already taken', async () => {
      organisations.findOne.mockResolvedValue(org(1, 'Acme'));
      await expect(service.create(loose({ name: 'acme' }))).rejects.toThrow(new BadRequestException(O.ERROR_NAME_TAKEN));
    });

    it('updates the name and description', async () => {
      organisations.findOne.mockResolvedValueOnce(org(1, 'Acme')).mockResolvedValueOnce(null).mockResolvedValueOnce(org(1, 'New'));
      await expect(service.update(1, loose({ name: 'New', description: 'd' }), admin())).resolves.toMatchObject({ data: { name: 'New' } });
      expect(organisations.update).toHaveBeenCalledWith({ name: 'New', description: 'd' }, { where: { id: 1 } });
    });

    it('does not re-check an unchanged name', async () => {
      organisations.findOne.mockResolvedValue(org(1, 'Acme'));
      await service.update(1, loose({ name: 'Acme' }), admin());
      expect(organisations.findOne).toHaveBeenCalledTimes(2);
    });

    it('refuses renaming onto a taken name', async () => {
      organisations.findOne.mockResolvedValueOnce(org(1, 'Acme')).mockResolvedValueOnce(org(2, 'Taken'));
      await expect(service.update(1, loose({ name: 'Taken' }), admin())).rejects.toThrow(new BadRequestException(O.ERROR_NAME_TAKEN));
    });

    it('deletes an empty organisation', async () => {
      organisations.findOne.mockResolvedValue(org(1));
      await expect(service.delete(1, admin())).resolves.toMatchObject({ message: O.MSG_DELETED });
    });

    it('refuses deleting one with members', async () => {
      organisations.findOne.mockResolvedValue(org(1));
      accountsService.count.mockResolvedValue({ count: 2 });
      await expect(service.delete(1, admin())).rejects.toThrow(new BadRequestException(O.ERROR_HAS_MEMBERS));
      expect(organisations.destroy).not.toHaveBeenCalled();
    });

    it.each(['update', 'delete'])('%s throws NotFound for a missing one', async (method) => {
      organisations.findOne.mockResolvedValue(null);
      await expect(loose(service)[method](1, {}, admin())).rejects.toThrow(NotFoundException);
    });

    it('hardDeleteByNamePrefix force-deletes', async () => {
      organisations.destroy.mockResolvedValue(2);
      await expect(service.hardDeleteByNamePrefix('ctest')).resolves.toBe(2);
      expect(organisations.destroy.mock.calls[0][0].force).toBe(true);
    });
  });

  describe('users', () => {
    describe('findUsersForAccount', () => {
      it('pins an owner to their own organisation whatever they ask for', async () => {
        accountsService.findAll.mockResolvedValue([]);
        await service.findUsersForAccount(owner({ organisationId: 1 }), 'a', 2);
        expect(accountsService.findAll.mock.calls[0][0].where.organisationId).toBe(1);
      });

      it('lets an admin narrow to any organisation', async () => {
        accountsService.findAll.mockResolvedValue([]);
        await service.findUsersForAccount(admin(), undefined, 2);
        expect(accountsService.findAll.mock.calls[0][0].where.organisationId).toBe(2);
      });

      it('refuses an owner with no organisation', async () => {
        await expect(service.findUsersForAccount(owner({ organisationId: null }))).rejects.toThrow(new ForbiddenException(U.ERROR_NO_ORGANISATION));
      });

      it('refuses a guest', async () => {
        await expect(service.findUsersForAccount(guest({ organisationId: null }))).rejects.toThrow(ForbiddenException);
      });

      it('refuses a stale session', async () => {
        await expect(service.findUsersForAccount(staleOwner())).rejects.toThrow(new UnauthorizedException(U.ERROR_STALE_SESSION));
      });
    });

    describe('createUser', () => {
      const created = () => accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 9 }, created: true });

      it('lets an admin create staff in a chosen organisation', async () => {
        created();
        await expect(service.createUser(loose({ email: 'a@x', role: AccountRole.HOTEL_STAFF, organisationId: 2 }), admin())).resolves.toMatchObject({ message: U.MSG_CREATED });
        expect(accountsService.findOrCreateByEmail.mock.calls[0][1]).toMatchObject({ organisationId: 2 });
      });

      it('lets an admin create an admin with no organisation', async () => {
        created();
        await service.createUser(loose({ email: 'a@x', role: AccountRole.ADMIN }), admin());
        expect(accountsService.findOrCreateByEmail.mock.calls[0][1].organisationId).toBeNull();
      });

      it('puts an owner-created user in the owner organisation', async () => {
        created();
        await service.createUser(loose({ email: 'a@x', role: AccountRole.HOTEL_STAFF }), owner({ organisationId: 1 }));
        expect(accountsService.findOrCreateByEmail.mock.calls[0][1].organisationId).toBe(1);
      });

      it('refuses an email already in use', async () => {
        accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 9 }, created: false });
        await expect(service.createUser(loose({ email: 'a@x', role: AccountRole.HOTEL_STAFF, organisationId: 2 }), admin())).rejects.toThrow(new BadRequestException(U.ERROR_EMAIL_TAKEN));
      });

      it.each([
        ['a guest', { role: AccountRole.GUEST }, admin, new BadRequestException(U.ERROR_GUEST_NOT_MANAGEABLE)],
        ['an admin, by an owner', { role: AccountRole.ADMIN }, () => owner({ organisationId: 1 }), new ForbiddenException(U.ERROR_CANNOT_CREATE_ADMIN)],
        ['an admin with an organisation', { role: AccountRole.ADMIN, organisationId: 1 }, admin, new BadRequestException(U.ERROR_ADMIN_HAS_NO_ORGANISATION)],
        ['staff without an organisation', { role: AccountRole.HOTEL_STAFF }, admin, new BadRequestException(U.ERROR_ORGANISATION_REQUIRED)],
        ['staff in another organisation', { role: AccountRole.HOTEL_STAFF, organisationId: 2 }, () => owner({ organisationId: 1 }), new ForbiddenException(U.ERROR_OUTSIDE_ORGANISATION)],
      ])('refuses %s', async (_name, dto, who, error) => {
        await expect(service.createUser(loose({ email: 'a@x', ...dto }), who())).rejects.toThrow(error);
        expect(accountsService.findOrCreateByEmail).not.toHaveBeenCalled();
      });

      // Known problem (test/README.md): staff manage users like an owner. Drop `.failing` once fixed.
      it.failing('refuses staff creating a user', async () => {
        created();
        await expect(service.createUser(loose({ email: 'a@x', role: AccountRole.HOTEL_STAFF }), staff({ organisationId: 1 }))).rejects.toThrow(ForbiddenException);
        expect(accountsService.findOrCreateByEmail).not.toHaveBeenCalled();
      });
    });

    describe('updateUser', () => {
      it('updates a user in the owner organisation', async () => {
        accountsService.findOne.mockResolvedValueOnce({ id: 9, role: AccountRole.HOTEL_STAFF, organisationId: 1 }).mockResolvedValueOnce({ id: 9, name: 'N' });
        await expect(service.updateUser(9, loose({ name: 'N' }), owner({ organisationId: 1 }))).resolves.toMatchObject({ data: { name: 'N' } });
        expect(accountsService.update).toHaveBeenCalledWith({ name: 'N', organisationId: 1 }, { id: 9 });
      });

      it('lets an admin move a user to another organisation', async () => {
        accountsService.findOne.mockResolvedValue({ id: 9, role: AccountRole.HOTEL_STAFF, organisationId: 1 });
        await service.updateUser(9, loose({ organisationId: 2, role: AccountRole.HOTEL_OWNER }), admin());
        expect(accountsService.update).toHaveBeenCalledWith({ role: AccountRole.HOTEL_OWNER, organisationId: 2 }, { id: 9 });
      });

      it('throws NotFound for a missing user', async () => {
        accountsService.findOne.mockResolvedValue(null);
        await expect(service.updateUser(9, loose({}), admin())).rejects.toThrow(new NotFoundException(U.ERROR_NOT_FOUND));
      });

      it('refuses a guest account', async () => {
        accountsService.findOne.mockResolvedValue({ id: 9, role: AccountRole.GUEST });
        await expect(service.updateUser(9, loose({}), admin())).rejects.toThrow(new BadRequestException(U.ERROR_GUEST_NOT_MANAGEABLE));
      });

      it('refuses a user in another organisation', async () => {
        accountsService.findOne.mockResolvedValue({ id: 9, role: AccountRole.HOTEL_STAFF, organisationId: 2 });
        await expect(service.updateUser(9, loose({}), owner({ organisationId: 1 }))).rejects.toThrow(new ForbiddenException(U.ERROR_OUTSIDE_ORGANISATION));
        expect(accountsService.update).not.toHaveBeenCalled();
      });

      it('refuses an owner promoting someone to admin', async () => {
        accountsService.findOne.mockResolvedValue({ id: 9, role: AccountRole.HOTEL_STAFF, organisationId: 1 });
        await expect(service.updateUser(9, loose({ role: AccountRole.ADMIN }), owner({ organisationId: 1 }))).rejects.toThrow(new ForbiddenException(U.ERROR_CANNOT_CREATE_ADMIN));
      });

      it('refuses staff with no organisation', async () => {
        await expect(service.updateUser(9, loose({}), staff({ organisationId: null }))).rejects.toThrow(new ForbiddenException(U.ERROR_NO_ORGANISATION));
      });

      // Known problem (test/README.md): staff manage users like an owner. Drop `.failing` once fixed.
      it.failing('refuses staff promoting themselves to owner', async () => {
        const me = staff({ organisationId: 1 });
        accountsService.findOne.mockResolvedValue({ id: me.id, role: AccountRole.HOTEL_STAFF, organisationId: 1 });
        await expect(service.updateUser(me.id, loose({ role: AccountRole.HOTEL_OWNER }), me)).rejects.toThrow(ForbiddenException);
        expect(accountsService.update).not.toHaveBeenCalled();
      });
    });
  });
});
