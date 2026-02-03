export enum AccountRole {
  ADMIN = 'admin',
  HOTEL_OWNER = 'hotel_owner',
  GUEST = 'guest',
  HOTEL_STAFF = 'hotel_staff',
}

export const ACCOUNT_ROLES = {
  ADMIN: AccountRole.ADMIN,
  HOTEL_OWNER: AccountRole.HOTEL_OWNER,
  GUEST: AccountRole.GUEST,
  HOTEL_STAFF: AccountRole.HOTEL_STAFF,
} as const;
