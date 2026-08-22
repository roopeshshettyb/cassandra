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

  // Readable by an owner as well as an admin, because the users screen needs the
  // organisation name to label rows. The service narrows an owner to their own.
  @Get()
  async findAll(@CurrentAccount() account: Account, @Query('keywords') keywords?: string) {
    return this.organisationsService.findAllForAccount(account, keywords);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    const data = await this.organisationsService.findByIdForAccount(id, account);
    return { success: true, message: this.constantsService.private.ORGANISATIONS.MSG_ONE_FETCHED, data };
  }

  // Creating and reshaping customer companies is platform work.
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

/**
 * Staff-side user administration.
 *
 * Separate from /accounts, which is self-service (me, count). These routes are
 * about administering other people, and are guarded by role inside the service
 * rather than by AdminOnly, because owners are allowed in — narrowed to their own
 * organisation.
 */
@Controller('organisation-users')
@UseGuards(JwtAuthGuard)
export class OrganisationUsersController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Get()
  async findAll(@CurrentAccount() account: Account, @Query('keywords') keywords?: string) {
    return this.organisationsService.findUsersForAccount(account, keywords);
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
