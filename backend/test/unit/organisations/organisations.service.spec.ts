import { ForbiddenException } from '@nestjs/common';
import { OrganisationsService } from '../../../src/organisations/organisations.service';
import { AccountRole } from '../../../src/common/constants/constants.service';
import { mock, constants, owner, staff, guest, loose } from '../helpers';

describe('OrganisationsService', () => {
  let organisations: any, accountsService: any;
  let service: OrganisationsService;
  const O = constants.private.ORGANISATIONS;
  const U = O.USERS;

  beforeEach(() => {
    organisations = mock({ create: jest.fn(async (v: any) => ({ id: 1, ...v })) });
    accountsService = mock();
    service = new OrganisationsService(organisations, accountsService, constants);
  });

  it('shows a guest no organisations', async () => {
    await expect(service.findAllForAccount(guest({ organisationId: null }))).resolves.toMatchObject({ data: [] });
    expect(organisations.findAll).not.toHaveBeenCalled();
  });

  it('creates an organisation with the name trimmed', async () => {
    organisations.findOne.mockResolvedValue(null);
    await expect(service.create(loose({ name: ' Acme ' }))).resolves.toMatchObject({ message: O.MSG_CREATED, data: { name: 'Acme', description: null } });
  });

  it('refuses a guest listing users', async () => {
    await expect(service.findUsersForAccount(guest({ organisationId: null }))).rejects.toThrow(ForbiddenException);
  });

  it('refuses an owner promoting someone to admin', async () => {
    accountsService.findOne.mockResolvedValue({ id: 9, role: AccountRole.HOTEL_STAFF, organisationId: 1 });
    await expect(service.updateUser(9, loose({ role: AccountRole.ADMIN }), owner({ organisationId: 1 }))).rejects.toThrow(new ForbiddenException(U.ERROR_CANNOT_CREATE_ADMIN));
  });

  // Known problems (test/README.md): staff manage users like an owner. Drop `.failing` once fixed.
  it.failing('refuses staff creating a user', async () => {
    accountsService.findOrCreateByEmail.mockResolvedValue({ account: { id: 9 }, created: true });
    await expect(service.createUser(loose({ email: 'a@x', role: AccountRole.HOTEL_STAFF }), staff({ organisationId: 1 }))).rejects.toThrow(ForbiddenException);
    expect(accountsService.findOrCreateByEmail).not.toHaveBeenCalled();
  });

  it.failing('refuses staff promoting themselves to owner', async () => {
    const me = staff({ organisationId: 1 });
    accountsService.findOne.mockResolvedValue({ id: me.id, role: AccountRole.HOTEL_STAFF, organisationId: 1 });
    await expect(service.updateUser(me.id, loose({ role: AccountRole.HOTEL_OWNER }), me)).rejects.toThrow(ForbiddenException);
    expect(accountsService.update).not.toHaveBeenCalled();
  });
});
