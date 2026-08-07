import { Account } from './accounts.model';

export const ACCOUNTS_REPOSITORY = 'ACCOUNTS_REPOSITORY';

export const AccountsRepository = {
  provide: ACCOUNTS_REPOSITORY,
  useValue: Account,
};

