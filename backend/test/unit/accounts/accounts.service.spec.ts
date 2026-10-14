import { BadRequestException } from '@nestjs/common';
import { AccountsService } from '../../../src/accounts/accounts.service';
import { mock, constants, guest } from '../helpers';

describe('AccountsService', () => {
  let repo: any;
  let service: AccountsService;
  const msg = constants.private.ACCOUNTS;

  beforeEach(() => {
    repo = mock();
    service = new AccountsService(repo, constants);
  });

  describe('findOrCreateByEmail', () => {
    it('returns the existing account, matching the email trimmed and lower-cased', async () => {
      const existing = guest();
      repo.findOne.mockResolvedValue(existing);
      await expect(service.findOrCreateByEmail('  USER@Unit.Test ')).resolves.toEqual({ account: existing, created: false });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'user@unit.test' } });
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it.each(['', '   ', undefined])('throws BadRequest for a blank email (%p)', async (email) => {
      await expect(service.findOrCreateByEmail(email)).rejects.toThrow(new BadRequestException(msg.ERROR_EMAIL_REQUIRED));
    });
  });
});
