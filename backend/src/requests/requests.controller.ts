import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { AppendMessageDto, CreateRequestDto, ListRequestsQueryDto, UpdateRequestDto } from './requests.dto';
import { LIST_QUERY_PIPE_OPTIONS } from '../common/dto/list-query.dto';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // No global validation pipe in this app, so the query DTO is validated per handler.
  @Get()
  async findAll(
    @CurrentAccount() account: Account,
    @Query(new ValidationPipe(LIST_QUERY_PIPE_OPTIONS)) query: ListRequestsQueryDto,
  ) {
    return this.requestsService.findPageForAccount(account, query);
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

