import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../../../src/accounts/accounts.service';
import { mock, constants, guest, sequelize, loose } from '../helpers';

describe('AccountsService', () => {
  let repo: any;
  let service: AccountsService;
  const msg = constants.private.ACCOUNTS;

  beforeEach(() => {
    repo = mock({ sequelize: sequelize() });
    service = new AccountsService(repo, constants);
  });

  describe('updateMe', () => {
    it('updates only the name of the signed-in account', async () => {
      const me = guest();
      repo.update.mockResolvedValue([1, [{ ...me, name: 'New' }]]);
      const result = await service.updateMe(loose({ name: 'New', role: 'admin' }), me);
      expect(repo.update).toHaveBeenCalledWith({ name: 'New' }, { where: { uuid: me.uuid }, returning: true });
      expect(result.name).toBe('New');
    });

    it('throws NotFound when the account no longer exists', async () => {
      repo.update.mockResolvedValue([0, []]);
      await expect(service.updateMe(loose({ name: 'x' }), guest())).rejects.toThrow(new NotFoundException('Account not found'));
    });
  });

  describe('findOrCreateByEmail', () => {
    it('returns the existing account, matching the email trimmed and lower-cased', async () => {
      const existing = guest();
      repo.findOne.mockResolvedValue(existing);
      await expect(service.findOrCreateByEmail('  USER@Unit.Test ')).resolves.toEqual({ account: existing, created: false });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'user@unit.test' } });
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('creates the account with the email uuid when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockImplementation(async (data: any) => [data, true]);
      const { account, created } = await service.findOrCreateByEmail('new@unit.test', { name: 'N' });
      expect(created).toBe(true);
      expect(account).toMatchObject({ uuid: 'email:new@unit.test', email: 'new@unit.test', name: 'N' });
    });

    it.each(['', '   ', undefined])('throws BadRequest for a blank email (%p)', async (email) => {
      await expect(service.findOrCreateByEmail(email)).rejects.toThrow(new BadRequestException(msg.ERROR_EMAIL_REQUIRED));
    });
  });

  describe('countByOrganisation', () => {
    it('returns an empty map without querying for no ids', async () => {
      await expect(service.countByOrganisation([])).resolves.toEqual({});
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('keys the grouped counts by organisation id', async () => {
      repo.findAll.mockResolvedValue([
        { organisationId: 1, count: '3' },
        { organisationId: 2, count: '1' },
      ]);
      await expect(service.countByOrganisation([1, 2])).resolves.toEqual({ 1: 3, 2: 1 });
    });
  });

  describe('push tokens', () => {
    it('adds a token with one atomic update', async () => {
      await service.addPushToken(5, 'tok');
      expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ expoPushTokens: expect.anything() }), { where: { id: 5 } });
    });

    it('ignores an empty token or an empty list', async () => {
      await service.addPushToken(5, '');
      await service.removePushTokens(5, []);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('removes tokens with one atomic update', async () => {
      await service.removePushTokens(5, ['a', 'b']);
      expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ expoPushTokens: expect.anything() }), { where: { id: 5 } });
    });
  });

  it('count wraps the repository count', async () => {
    repo.count.mockResolvedValue(4);
    await expect(service.countWithFilter('{"where":{"role":"guest"}}')).resolves.toEqual({ count: 4 });
    expect(repo.count).toHaveBeenCalledWith({ where: { role: 'guest' } });
  });
});
