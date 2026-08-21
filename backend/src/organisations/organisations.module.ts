import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { OrganisationsRepository } from './organisations.repository';
import { OrganisationsService } from './organisations.service';
import { OrganisationsController, OrganisationUsersController } from './organisations.controller';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [DatabaseModule, CommonModule, forwardRef(() => AccountsModule)],
  controllers: [OrganisationsController, OrganisationUsersController],
  providers: [OrganisationsRepository, OrganisationsService],
  exports: [OrganisationsRepository, OrganisationsService],
})
export class OrganisationsModule {}
