/**
 * Controllers that add something of their own on top of their service: a wrapper,
 * a conversion or a check. Pure pass-throughs are covered by their service specs
 * and by the route access rules in routes.spec.ts.
 */
import { AppController } from '../../src/app.controller';
import { ConstantsController } from '../../src/common/constants/constants.controller';
import { AccountsController } from '../../src/accounts/accounts.controller';
import { BookingsController } from '../../src/bookings/bookings.controller';
import { OrganisationsController, OrganisationUsersController } from '../../src/organisations/organisations.controller';
import { RequestsController } from '../../src/requests/requests.controller';
import { mock, constants, guest, owner, loose } from './helpers';

describe('AppController', () => {
  it('reports health', () => {
    expect(new AppController(mock()).getHealth()).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });
});

describe('ConstantsController', () => {
  it('serves only the public constants', () => {
    const body = new ConstantsController(constants).getPublicConstants();
    expect(body).toEqual(constants.public);
    expect(body).not.toHaveProperty('JWT_SECRET');
    expect(body).not.toHaveProperty('DB_PASSWORD');
  });
});

describe('AccountsController', () => {
  it('me returns the caller', async () => {
    const me = guest();
    await expect(new AccountsController(mock()).getMe(me)).resolves.toEqual({ data: me, success: true });
  });

  it('findById only ever returns the caller, whatever id is asked for', async () => {
    const service = mock();
    const me = guest();
    await new AccountsController(service).findById('999', me);
    expect(service.findOne).toHaveBeenCalledWith({ where: { uuid: me.uuid } });
  });

  it('updateMe updates the caller', async () => {
    const service = mock();
    const me = guest();
    await new AccountsController(service).updateMe(loose({ name: 'N' }), me);
    expect(service.updateMe).toHaveBeenCalledWith({ name: 'N' }, me);
  });
});

describe('BookingsController', () => {
  it('send-pending-invites runs the job and answers success', async () => {
    const service = mock();
    await expect(new BookingsController(service).sendPendingInvites()).resolves.toMatchObject({ success: true });
    expect(service.sendPendingInviteEmails).toHaveBeenCalled();
  });
});

describe('OrganisationsController', () => {
  it('wraps a single organisation in the standard response', async () => {
    const service = mock({ findByIdForAccount: jest.fn(async () => ({ id: 1 })) });
    await expect(new OrganisationsController(service, constants).findOne(1, owner())).resolves.toEqual({
      success: true,
      message: constants.private.ORGANISATIONS.MSG_ONE_FETCHED,
      data: { id: 1 },
    });
  });

  it('users: converts the organisation filter to a number, or leaves it out', async () => {
    const service = mock();
    const me = owner();
    const controller = new OrganisationUsersController(service);
    await controller.findAll(me, 'a', '2');
    await controller.findAll(me);
    expect(service.findUsersForAccount.mock.calls).toEqual([
      [me, 'a', 2],
      [me, undefined, undefined],
    ]);
  });
});

describe('RequestsController', () => {
  it('append-message passes only the message text', async () => {
    const service = mock();
    const me = guest();
    await new RequestsController(service).appendMessage(1, loose({ message: 'hi' }), me);
    expect(service.appendMessage).toHaveBeenCalledWith(1, 'hi', me);
  });
});
