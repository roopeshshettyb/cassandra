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

/**
 * Organisations, and the staff-side user administration that hangs off them.
 *
 * The scoping rule the whole module turns on: an admin is platform staff with no
 * organisation and sees everything; an owner sees exactly their own. Every read
 * and write here goes through that narrowing rather than trusting an id from the
 * request, so an owner cannot reach another company's users by guessing.
 */
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

  /**
   * The caller as the database sees them now, not as their token claims.
   *
   * The JWT carries id, uuid, email, name, role and picture — not organisationId
   * — and JwtStrategy hands that payload back as the Account, so reading the
   * organisation off it yields undefined for everyone and every owner falls into
   * the "no organisation" branch.
   *
   * Adding it to the token would fix that and introduce something worse: a token
   * outlives an admin moving someone between organisations, so the holder would
   * keep reaching the organisation they were moved out of until they happened to
   * sign in again. Role has the same problem. Both are permission inputs, so both
   * are read fresh, at the cost of one indexed lookup per request.
   */
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

    // An owner is not allowed to enumerate the platform's customers, only their
    // own. Admins are the only role with no organisation, so this is not a
    // "missing value" branch — it is the permission.
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

    // Member counts are what the list is actually judged on, and doing them in
    // one grouped query keeps this off an N+1 as the customer list grows.
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
    // Deliberately the same error as "does not exist": telling an owner that an
    // organisation exists but is not theirs leaks the customer list.
    if (user.role !== AccountRole.ADMIN && user.organisationId !== organisation.id) {
      throw new NotFoundException(this.config.ERROR_NOT_FOUND);
    }
    return organisation;
  }

  async create(dto: CreateOrganisationDto) {
    await this.assertNameFree(dto.name);
    const data = await this.organisationsRepository.create({
      name: dto.name.trim(),
      description: dto.description ?? null,
    } as any);
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

    // Refuse rather than orphan. A user left with a dangling organisationId reads
    // as unscoped, which is a quiet privilege change instead of a loud error.
    const members = await this.accountsService.count({ where: { organisationId: id } });
    if (members.count > 0) {
      throw new BadRequestException(this.config.ERROR_HAS_MEMBERS);
    }

    await this.organisationsRepository.destroy({ where: { id } });
    return { success: true, message: this.config.MSG_DELETED, data: null };
  }

  /**
   * Hard-delete every organisation whose name carries a given prefix.
   *
   * Test-support only, and deliberately force: the API test suite tags rows with
   * a run id, and a soft delete would leave them accumulating. This database
   * still holds such litter from an earlier attempt, which is the argument for
   * cleaning up properly rather than the argument for not bothering.
   */
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

  /**
   * The organisation a write is allowed to touch, or null for an admin (meaning
   * "any"). Centralised so every user-facing mutation narrows the same way.
   */
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

  async findUsersForAccount(currentAccount: Account, keywords?: string) {
    const scoped = await this.scopeOrganisationId(currentAccount);
    const where: any = {
      // Guests are booking-side accounts and there are far more of them than
      // staff; listing them here would bury the people this screen is about.
      role: { [Op.ne]: AccountRole.GUEST },
    };
    if (scoped != null) {
      where.organisationId = scoped;
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

    // Same shape the staff-invite path uses, so a user created here and one
    // invited to a hotel are the same kind of account.
    const [account] = await this.accountsService.upsert({
      uuid: `email:${email}`,
      email,
      name: dto.name,
      oauthMeta: {},
      role: dto.role,
      organisationId,
    } as any);

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
    // Reach check on the user as they are now, before any requested change.
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

  /**
   * The one place the role/organisation rules live.
   *
   * Admins are platform staff and carry no organisation; owners and staff must
   * carry one. An owner may only ever write their own, and may not mint an admin
   * — that would let them promote themselves out of the scope that contains them.
   */
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

    // Owner or staff from here on, so an organisation is mandatory.
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
