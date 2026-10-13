/**
 * Shared helpers for unit tests (test/unit/**\/*.spec.ts).
 *
 * Services are built with `new Service(...)` and mocked dependencies, so nothing
 * touches the database, S3, email or a model.
 */
import { ConfigService } from '@nestjs/config';
import { ConstantsService, AccountRole } from '../../src/common/constants/constants.service';

/** A stand-in for any repository or service: every method is a jest.fn(), created on first use. */
export function mock(methods: any = {}): any {
  return new Proxy(methods, {
    get: (target, key) => {
      if (key === 'then' || typeof key === 'symbol') return undefined;
      if (!(key in target)) target[key] = jest.fn();
      return target[key];
    },
  });
}

/** Passes a partial DTO, a fake row or an off-type value to a typed parameter, typed `: any` rather than cast. */
export function loose(value: any): any {
  return value;
}

/** The real constants, built from an empty env so only the defaults in constants.service.ts apply. */
export const constants = new ConstantsService(new ConfigService({}));

let nextId = 1000;
/** A signed-in account. */
function account(role: AccountRole, extra: any = {}): any {
  const id = nextId++;
  return { id, uuid: `email:user${id}@unit.test`, email: `user${id}@unit.test`, role, organisationId: role === AccountRole.ADMIN ? null : 1, ...extra };
}

export const admin = (extra: any = {}) => account(AccountRole.ADMIN, extra);
export const owner = (extra: any = {}) => account(AccountRole.HOTEL_OWNER, extra);
export const staff = (extra: any = {}) => account(AccountRole.HOTEL_STAFF, extra);
export const guest = (extra: any = {}) => account(AccountRole.GUEST, extra);

/** A Sequelize-style row: plain fields plus the instance methods services call. */
export function row(fields: any = {}): any {
  const r: any = { ...fields };
  r.update = jest.fn(async (changes: any) => Object.assign(r, changes));
  r.save = jest.fn(async () => r);
  r.destroy = jest.fn(async () => undefined);
  r.get = jest.fn(() => ({ ...fields }));
  return r;
}

/** A sequelize stub whose transaction() runs the callback with a fake transaction. */
export function sequelize(): any {
  return mock({
    transaction: jest.fn(async (fn?: any) => (fn ? fn({}) : {})),
    escape: jest.fn((v: string) => `'${v}'`),
  });
}
