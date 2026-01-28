import { Options } from 'sequelize';

export interface IDatabaseConfig {
  databaseConfiguration: IDatabaseConfigAttributes;
}

export interface IDatabaseConfigAttributes extends Options {
  dialect: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

