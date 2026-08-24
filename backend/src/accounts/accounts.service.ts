import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { Account } from './accounts.model';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { FindOptions, CountOptions } from 'sequelize';
import { literal } from 'sequelize';

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

  // Member counts keyed by organisation id, in one grouped query. A missing key
  // means no members.
  async countByOrganisation(organisationIds: number[]): Promise<Record<number, number>> {
    if (!organisationIds.length) {
      return {};
    }
    const rows = await this.accountsRepository.findAll({
      attributes: ['organisationId', [literal('COUNT(*)'), 'count']],
      where: { organisationId: organisationIds },
      group: ['organisation_id'],
      raw: true,
    });
    const counts: Record<number, number> = {};
    for (let i = 0; i < rows.length; i++) {
      const row: any = rows[i];
      counts[row.organisationId] = parseInt(row.count, 10);
    }
    return counts;
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

  async delete(filter: any, force = false): Promise<number> {
    return this.accountsRepository.destroy({ where: filter, force });
  }

  // The `email:` uuid convention lives here so callers do not each rebuild it.
  // Returns created=false when the account already existed, which the staff and
  // organisation-user flows branch on.
  async findOrCreateByEmail(rawEmail: string, defaults: Partial<Account> = {}): Promise<{ account: Account; created: boolean }> {
    const email = rawEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    const existing = await this.findOne({ where: { email } });
    if (existing) {
      return { account: existing, created: false };
    }
    const attributes: any = { uuid: `email:${email}`, email, oauthMeta: {}, ...defaults };
    const [account] = await this.upsert(attributes);
    return { account, created: true };
  }

  async upsert(data: Partial<Account>): Promise<[Account, boolean]> {
    return this.accountsRepository.upsert(data, { conflictFields: ['uuid'] });
  }

  // Atomic JSONB array append with in-DB dedup. Safe under concurrent device
  // registrations (read-modify-write would lose tokens). Postgres-only.
  async addPushToken(accountId: number, token: string): Promise<void> {
    if (!token) return;
    const newArr = this.accountsRepository.sequelize!.escape(JSON.stringify([token]));
    const expr: any = literal(
      `(SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb) FROM jsonb_array_elements_text(expo_push_tokens || ${newArr}::jsonb) AS t)`,
    );
    await this.accountsRepository.update({ expoPushTokens: expr }, { where: { id: accountId } });
  }

  // Atomic JSONB array filter — drops the given tokens (stale/invalid from FCM).
  async removePushTokens(accountId: number, tokens: string[]): Promise<void> {
    if (!tokens?.length) return;
    const dropArr = this.accountsRepository.sequelize!.escape(JSON.stringify(tokens));
    const expr: any = literal(
      `(SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM jsonb_array_elements_text(expo_push_tokens) AS t WHERE NOT (t = ANY (SELECT jsonb_array_elements_text(${dropArr}::jsonb))))`,
    );
    await this.accountsRepository.update({ expoPushTokens: expr }, { where: { id: accountId } });
  }
}
