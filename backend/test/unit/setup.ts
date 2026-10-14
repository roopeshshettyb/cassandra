/**
 * Registers every model with a Sequelize instance that never connects, so model
 * metadata (attributes, list filters, associations) works in unit tests while
 * any real query fails loudly instead of reaching a database.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Model, Sequelize } from 'sequelize-typescript';

const models: any[] = [];
(function load(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) load(file);
    else if (entry.name.endsWith('.model.ts')) models.push(...Object.values(require(file)).filter((value: any) => value?.prototype instanceof Model));
  }
})(path.join(__dirname, '../../src'));

new Sequelize({ dialect: 'postgres', logging: false, models });
