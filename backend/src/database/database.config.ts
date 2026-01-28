import { Injectable } from '@nestjs/common';
import { IDatabaseConfig, IDatabaseConfigAttributes } from './database.config.interface';
import { LoggerService } from '../common/logger.service';
import { ConstantsService } from '../common/constants/constants.service';

@Injectable()
export class DatabaseConfig implements IDatabaseConfig {
  constructor(private constantsService: ConstantsService, private logger: LoggerService) {
    this.logger.log({
      message: 'Database configuration initialized',
      traces: [{ nodeEnv: this.constantsService.private.NODE_ENV }],
    });
  }

  /**
   * Extract Database Configuration from Environment File
   */
  get databaseConfiguration(): IDatabaseConfigAttributes {
    const privateConstants = this.constantsService.private;

    return {
      dialect: 'postgres',
      host: privateConstants.DB_HOST,
      port: privateConstants.DB_PORT,
      username: privateConstants.DB_USERNAME,
      password: privateConstants.DB_PASSWORD,
      database: privateConstants.DB_NAME,
      logging: privateConstants.DB_LOGGING,
      define: {
        underscored: true,
        timestamps: true,
      },
      // sync: {
      //   alter: true,
      // },
      pool: {
        max: privateConstants.DB_POOL_SIZE,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: privateConstants.DB_SSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : undefined,
    };
  }
}
