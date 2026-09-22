import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { ListQuery } from '../common/filters/list-filters';
import { AppendMessageDto, CreateRequestDto, UpdateRequestDto } from './requests.dto';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // The query is validated against the model's flagged columns, not a DTO — see list-filters.
  @Get()
  async findAll(@CurrentAccount() account: Account, @Query() query: ListQuery) {
    return this.requestsService.findAllForAccount(account, query);
  }

  /** The filters this list offers, so the UI does not hardcode them. Declared before :id to match first. */
  @Get('filters')
  getFilters() {
    return this.requestsService.getListFilterMeta();
  }

  @Post()
  async create(@Body(ValidationPipe) dto: CreateRequestDto, @CurrentAccount() account: Account) {
    return this.requestsService.create(dto, account);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account) {
    return this.requestsService.findByIdForAccount(id, account);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateRequestDto,
    @CurrentAccount() account: Account,
  ) {
    return this.requestsService.update(id, dto, account);
  }

  @Post(':id/append-message')
  async appendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) body: AppendMessageDto,
    @CurrentAccount() account: Account,
  ) {
    return this.requestsService.appendMessage(id, body.message, account);
  }
}

