import * as dotenv from 'dotenv';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { Account } from './accounts/accounts.model';
import { AccountRole } from './accounts/accounts.model';
import { randomUUID } from 'crypto';

// Load environment variables from env file (same pattern as NestJS app)
const nodeEnv = process.env.NODE_ENV || 'dev';
// const envFile = nodeEnv === 'prod' ? 'prod.env' : 'dev.env';
const envFile = 'prod.env';
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) });

const X_AD_SPACES = {
  badge: {
    label: 'Badge',
    status: 'AVAILABLE',
  },
  header: {
    label: 'Header',
    status: 'AVAILABLE',
    requiresMedia: true,
  },
  linkInBio: {
    label: 'Link In Bio',
    status: 'AVAILABLE',
  },
  textPost: {
    label: 'Text Post',
    status: 'UNAVAILABLE',
  },
  videoPost: {
    label: 'Video Post',
    status: 'AVAILABLE',
    requiresMedia: true,
  },
};

async function seed() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbUsername = process.env.DB_USERNAME || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'profile_aura';
  const dbSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbName,
    logging: false,
    models: [Account],
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: dbSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : undefined,
  });
}

seed();
