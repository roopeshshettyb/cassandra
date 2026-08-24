import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import {
  CreateOrganisationDto,
  CreateOrganisationUserDto,
  UpdateOrganisationDto,
  UpdateOrganisationUserDto,
} from './organisations.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { ConstantsService } from '../common/constants/constants.service';

@Controller('organisations')
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly constantsService: ConstantsService,
  ) {}

  // Owners may read their own; the service narrows them.
  @Get()
  async findAll(@CurrentAccount() account: Account, @Query('keywords') keywords?: string) {
    return this.organisationsService.findAllForAccount(account, keywords);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    const data = await this.organisationsService.findByIdForAccount(id, account);
    return { success: true, message: this.constantsService.private.ORGANISATIONS.MSG_ONE_FETCHED, data };
  }

  @Post()
  @AdminOnly()
  async create(@Body(ValidationPipe) dto: CreateOrganisationDto) {
    return this.organisationsService.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateOrganisationDto,
    @CurrentAccount() account: Account,
  ) {
    return this.organisationsService.update(id, dto, account);
  }

  @Delete(':id')
  @AdminOnly()
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.organisationsService.delete(id, account);
  }
}

// Separate from /accounts, which is self-service. Guarded in the service rather
// than by AdminOnly, because owners are allowed in but narrowed to their own.
@Controller('organisation-users')
@UseGuards(JwtAuthGuard)
export class OrganisationUsersController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  // organisationId narrows for the detail page; an owner stays pinned to theirs.
  @Get()
  async findAll(
    @CurrentAccount() account: Account,
    @Query('keywords') keywords?: string,
    @Query('organisationId') organisationId?: string,
  ) {
    const scopedTo = organisationId ? Number(organisationId) : undefined;
    return this.organisationsService.findUsersForAccount(account, keywords, scopedTo);
  }

  @Post()
  async create(@Body(ValidationPipe) dto: CreateOrganisationUserDto, @CurrentAccount() account: Account) {
    return this.organisationsService.createUser(dto, account);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateOrganisationUserDto,
    @CurrentAccount() account: Account,
  ) {
    return this.organisationsService.updateUser(id, dto, account);
  }
}
