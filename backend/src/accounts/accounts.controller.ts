import { Controller, Post, Body, Get, Query, Patch, Param, Delete, ValidationPipe, UseGuards } from '@nestjs/common';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { AccountsService } from './accounts.service';
import { FindOptions, CountOptions } from 'sequelize';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { Account } from './accounts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  async create(@Body(ValidationPipe) createAccountDto: CreateAccountDto) {
    return this.accountsService.create(createAccountDto);
  }

  @Get('count')
  async count(@Query('filter') filter?: string) {
    const countOptions: CountOptions = filter ? JSON.parse(filter) : {};
    return this.accountsService.count(countOptions);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentAccount() account: Account) {
    return account;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.accountsService.findOne({ where: { uuid: account.uuid } });
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Body(ValidationPipe) updateAccountDto: UpdateAccountDto, @CurrentAccount() account: Account) {
    await this.accountsService.update({ defaultCurrency: updateAccountDto.defaultCurrency }, { uuid: account.uuid });
    return this.accountsService.findOne({ where: { uuid: account.uuid } });
  }
}
