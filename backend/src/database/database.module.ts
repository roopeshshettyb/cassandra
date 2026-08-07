import { Module } from '@nestjs/common';
import { DATABASE_PROVIDERS } from './database.providers';
import { DatabaseConfig } from './database.config';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [...DATABASE_PROVIDERS, DatabaseConfig],
  exports: [...DATABASE_PROVIDERS],
})
export class DatabaseModule {}
