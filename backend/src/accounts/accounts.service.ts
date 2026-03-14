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

  async findById(id: string): Promise<Account | null> {
    return this.accountsRepository.findByPk(id);
  }

  async findOne(filter: FindOptions): Promise<Account | null> {
    return this.accountsRepository.findOne(filter);
  }

  async count(filter: CountOptions): Promise<{ count: number }> {
    const totalCount = await this.accountsRepository.count(filter);
    return { count: totalCount };
  }

  async update(data: any, filter: any): Promise<[number]> {
    return this.accountsRepository.update(data, { where: filter });
  }

  async delete(filter: any): Promise<number> {
    return this.accountsRepository.destroy({ where: filter });
  }

  async upsert(data: Partial<Account>): Promise<[Account, boolean]> {
    return this.accountsRepository.upsert(data, { conflictFields: ['uuid'] });
  }
}
