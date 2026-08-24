import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import { ORGANISATIONS_REPOSITORY } from './organisations.repository';
import { Organisation } from './organisations.model';
import {
  CreateOrganisationDto,
  CreateOrganisationUserDto,
  UpdateOrganisationDto,
  UpdateOrganisationUserDto,
} from './organisations.dto';
import { Account } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AccountRole, ConstantsService } from '../common/constants/constants.service';

// Admins are platform staff with no organisation and see everything; owners see
// only their own. Every read and write narrows through that.
@Injectable()
export class OrganisationsService {
  constructor(
    @Inject(ORGANISATIONS_REPOSITORY) private readonly organisationsRepository: typeof Organisation,
    private readonly accountsService: AccountsService,
    private readonly constantsService: ConstantsService,
  ) {}

  private get config() {
    return this.constantsService.private.ORGANISATIONS;
  }

  // CurrentAccount is the decoded JWT, which carries no organisationId, so it has
  // to be read from the database. Doing the same for role avoids a stale token
  // keeping access after an admin moves someone.
  private async currentUser(account: Account): Promise<Account> {
    const fresh = await this.accountsService.findOne({ where: { id: account.id } });
    if (!fresh) {
      throw new ForbiddenException(this.userConfig.ERROR_NOT_FOUND);
    }
    return fresh;
  }

  // ── Organisations ──────────────────────────────────────────────────────────

  async findAllForAccount(currentAccount: Account, keywords?: string) {
    const user = await this.currentUser(currentAccount);
    const where: any = {};

    if (user.role !== AccountRole.ADMIN) {
      if (user.organisationId == null) {
        return { success: true, message: this.config.MSG_FETCHED, data: [] };
      }
      where.id = user.organisationId;
    }

    if (keywords) {
      const pattern = `%${keywords}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: pattern } },
        { description: { [Op.iLike]: pattern } },
      ];
    }

    const data = await this.organisationsRepository.findAll({
      where,
      order: [['name', 'ASC']],
    });

    // One grouped query rather than a count per row.
    const counts = await this.accountsService.countByOrganisation(data.map((o) => o.id));
    const withCounts = data.map((organisation) => ({
      ...organisation.toJSON(),
      memberCount: counts[organisation.id] ?? 0,
    }));

    return { success: true, message: this.config.MSG_FETCHED, data: withCounts };
  }

  async findByIdForAccount(id: number, currentAccount: Account): Promise<Organisation> {
    const user = await this.currentUser(currentAccount);
    const organisation = await this.organisationsRepository.findOne({ where: { id } });
    if (!organisation) {
      throw new NotFoundException(this.config.ERROR_NOT_FOUND);
    }
    // Same error as "does not exist", so ids cannot be probed.
    if (user.role !== AccountRole.ADMIN && user.organisationId !== organisation.id) {
      throw new NotFoundException(this.config.ERROR_NOT_FOUND);
    }
    return organisation;
  }

  async create(dto: CreateOrganisationDto) {
    await this.assertNameFree(dto.name);
    // `: any` rather than a cast — Sequelize's create() types want every model
    // attribute, including the generated ones.
    const attributes: any = { name: dto.name.trim(), description: dto.description ?? null };
    const data = await this.organisationsRepository.create(attributes);
    return { success: true, message: this.config.MSG_CREATED, data };
  }

  async update(id: number, dto: UpdateOrganisationDto, currentAccount: Account) {
    const organisation = await this.findByIdForAccount(id, currentAccount);
    if (dto.name && dto.name.trim() !== organisation.name) {
      await this.assertNameFree(dto.name);
    }
    await this.organisationsRepository.update(
      {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      { where: { id } },
    );
    const data = await this.organisationsRepository.findOne({ where: { id } });
    return { success: true, message: this.config.MSG_UPDATED, data };
  }

  async delete(id: number, currentAccount: Account) {
    await this.findByIdForAccount(id, currentAccount);

    // Refuse rather than orphan: a dangling organisationId reads as unscoped.
    const members = await this.accountsService.count({ where: { organisationId: id } });
    if (members.count > 0) {
      throw new BadRequestException(this.config.ERROR_HAS_MEMBERS);
    }

    await this.organisationsRepository.destroy({ where: { id } });
    return { success: true, message: this.config.MSG_DELETED, data: null };
  }

  // Test support: the API suite tags rows with a run id and force-deletes them,
  // since soft deletes would accumulate.
  async hardDeleteByNamePrefix(prefix: string): Promise<number> {
    return this.organisationsRepository.destroy({
      where: { name: { [Op.iLike]: `%${prefix}%` } },
      force: true,
    });
  }

  private async assertNameFree(name: string): Promise<void> {
    const existing = await this.organisationsRepository.findOne({
      where: { name: { [Op.iLike]: name.trim() } },
    });
    if (existing) {
      throw new BadRequestException(this.config.ERROR_NAME_TAKEN);
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  private get userConfig() {
    return this.config.USERS;
  }

  // The organisation a write may touch; null for an admin, meaning any.
  private async scopeOrganisationId(currentAccount: Account): Promise<number | null> {
    const user = await this.currentUser(currentAccount);
    if (user.role === AccountRole.ADMIN) {
      return null;
    }
    if (user.organisationId == null) {
      throw new ForbiddenException(this.userConfig.ERROR_NO_ORGANISATION);
    }
    return user.organisationId;
  }

  async findUsersForAccount(currentAccount: Account, keywords?: string, organisationId?: number) {
    const scoped = await this.scopeOrganisationId(currentAccount);
    // Guests are booking-side accounts and would bury the staff this screen is for.
    const where: any = { role: { [Op.ne]: AccountRole.GUEST } };
    if (scoped != null) {
      // An owner's own always wins over a requested one.
      where.organisationId = scoped;
    } else if (organisationId != null) {
      where.organisationId = organisationId;
    }

    if (keywords) {
      const pattern = `%${keywords}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
      ];
    }

    const data = await this.accountsService.findAll({
      where,
      include: [{ model: Organisation, attributes: ['id', 'name'] }],
      attributes: ['id', 'name', 'email', 'role', 'organisationId', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: this.userConfig.DEFAULT_LIST_LIMIT,
    });

    return { success: true, message: this.userConfig.MSG_FETCHED, data };
  }

  async createUser(dto: CreateOrganisationUserDto, currentAccount: Account) {
    const actor = await this.currentUser(currentAccount);
    const scoped = await this.scopeOrganisationId(currentAccount);
    const organisationId = this.resolveOrganisationForRole(dto.role, dto.organisationId ?? null, scoped, actor);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.accountsService.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException(this.userConfig.ERROR_EMAIL_TAKEN);
    }

    const newAccount: any = {
      uuid: `email:${email}`,
      email,
      name: dto.name,
      oauthMeta: {},
      role: dto.role,
      organisationId,
    };
    const [account] = await this.accountsService.upsert(newAccount);

    return { success: true, message: this.userConfig.MSG_CREATED, data: account };
  }

  async updateUser(id: number, dto: UpdateOrganisationUserDto, currentAccount: Account) {
    const scoped = await this.scopeOrganisationId(currentAccount);

    const target = await this.accountsService.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException(this.userConfig.ERROR_NOT_FOUND);
    }
    if (target.role === AccountRole.GUEST) {
      throw new BadRequestException(this.userConfig.ERROR_GUEST_NOT_MANAGEABLE);
    }
    if (scoped != null && target.organisationId !== scoped) {
      throw new ForbiddenException(this.userConfig.ERROR_OUTSIDE_ORGANISATION);
    }

    const actor = await this.currentUser(currentAccount);
    const role = dto.role ?? target.role;
    const requestedOrganisationId = dto.organisationId !== undefined ? dto.organisationId : target.organisationId;
    const organisationId = this.resolveOrganisationForRole(role, requestedOrganisationId, scoped, actor);

    await this.accountsService.update(
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role && { role }),
        organisationId,
      },
      { id },
    );

    const data = await this.accountsService.findOne({ where: { id } });
    return { success: true, message: this.userConfig.MSG_UPDATED, data };
  }

  // Admins carry no organisation; owners and staff must. An owner may not mint an
  // admin, which would promote them out of their own scope.
  private resolveOrganisationForRole(
    role: AccountRole,
    requestedOrganisationId: number | null,
    scoped: number | null,
    currentAccount: Account,
  ): number | null {
    if (role === AccountRole.GUEST) {
      throw new BadRequestException(this.userConfig.ERROR_GUEST_NOT_MANAGEABLE);
    }

    if (role === AccountRole.ADMIN) {
      if (currentAccount.role !== AccountRole.ADMIN) {
        throw new ForbiddenException(this.userConfig.ERROR_CANNOT_CREATE_ADMIN);
      }
      if (requestedOrganisationId != null) {
        throw new BadRequestException(this.userConfig.ERROR_ADMIN_HAS_NO_ORGANISATION);
      }
      return null;
    }

    if (scoped != null) {
      if (requestedOrganisationId != null && requestedOrganisationId !== scoped) {
        throw new ForbiddenException(this.userConfig.ERROR_OUTSIDE_ORGANISATION);
      }
      return scoped;
    }

    if (requestedOrganisationId == null) {
      throw new BadRequestException(this.userConfig.ERROR_ORGANISATION_REQUIRED);
    }
    return requestedOrganisationId;
  }
}
