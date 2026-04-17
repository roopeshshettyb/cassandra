import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { Account } from './accounts.model';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { FindOptions, CountOptions } from 'sequelize';

@Injectable()
export class AccountsService {
  constructor(@Inject(ACCOUNTS_REPOSITORY) private readonly accountsRepository: typeof Account) {}

  async create(createAccountDto: any): Promise<Account> {
    return this.accountsRepository.create<Account>(createAccountDto);
  }

  async findAll(filter: FindOptions): Promise<Account[]> {
    return this.accountsRepository.findAll(filter);
  }

  async findByUuid(uuid: string): Promise<Account | null> {
    return this.accountsRepository.findOne({ where: { uuid } });
  }

  async findOne(filter: FindOptions): Promise<Account | null> {
    return this.accountsRepository.findOne(filter);
  }

  async count(filter: CountOptions): Promise<{ count: number }> {
    const totalCount = await this.accountsRepository.count(filter);
    return { count: totalCount };
  }

  async countWithFilter(filter?: string): Promise<{ count: number }> {
    const countOptions: CountOptions = filter ? JSON.parse(filter) : {};
    return this.count(countOptions);
  }

  async update(data: any, filter: any): Promise<[number, Account[]]> {
    return this.accountsRepository.update(data, { where: filter, returning: true });
  }

  async updateMe(updateAccountDto: UpdateAccountDto, account: Account): Promise<Account> {
    const [affectedCount, updatedAccounts] = await this.update(
      { name: updateAccountDto.name },
      { uuid: account.uuid },
    );
    if (affectedCount === 0) {
      throw new NotFoundException('Account not found');
    }
    return updatedAccounts[0];
  }

  async delete(filter: any): Promise<number> {
    return this.accountsRepository.destroy({ where: filter });
  }

  async upsert(data: Partial<Account>): Promise<[Account, boolean]> {
    return this.accountsRepository.upsert(data, { conflictFields: ['uuid'] });
  }

  async updateNotificationPreferences(accountId: number, prefs: { push?: boolean; email?: boolean }): Promise<Account> {
    const account = await this.accountsRepository.findByPk(accountId);
    if (!account) throw new NotFoundException('Account not found');
    const current = account.notificationPreferences ?? { push: true, email: true };
    const merged = { ...current, ...prefs };
    const [, updated] = await this.update({ notificationPreferences: merged }, { id: accountId });
    return updated[0];
  }
}
