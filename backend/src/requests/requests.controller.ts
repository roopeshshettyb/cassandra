import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from '../accounts/accounts.model';
import { AppendMessageDto, CreateRequestDto, UpdateRequestDto } from './requests.dto';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  async findAll(@CurrentAccount() account: Account) {
    return this.requestsService.findAllForAccount(account);
  }

  @Post()
  async create(@Body(ValidationPipe) dto: CreateRequestDto, @CurrentAccount() account: Account) {
    return this.requestsService.create(dto, account);
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
    // Route to user or staff append based on role; must mirror LangGraph behavior.
    if (account.role === 'guest') {
      return this.requestsService.appendUserMessage(id, body.message, account);
    }
    return this.requestsService.appendStaffMessage(id, body.message, account);
  }
}

