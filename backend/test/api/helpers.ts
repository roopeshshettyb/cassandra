/**
 * Shared setup for the API suites: HTTP calls against the running backend, and
 * real accounts that sign in through the OTP flow. Settings come from env.ts.
 */
import axios, { AxiosResponse } from 'axios';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OAuthModule } from '../../src/oauth/oauth.module';
import { BookingsModule } from '../../src/bookings/bookings.module';
import { HotelsModule } from '../../src/hotels/hotels.module';
import { RestaurantModule } from '../../src/restaurant/restaurant.module';
import { OrganisationsModule } from '../../src/organisations/organisations.module';
import { AccountsService } from '../../src/accounts/accounts.service';
import { EmailService } from '../../src/oauth/email/email.service';
import { ConstantsService } from '../../src/common/constants/constants.service';
import { AccountRole, Account } from '../../src/accounts/accounts.model';

export interface Session {
  id: number;
  email: string;
  token: string;
  account: Account;
}

export async function bootstrap(): Promise<{ moduleRef: TestingModule; baseUrl: string; constants: ConstantsService }> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), OAuthModule, BookingsModule, HotelsModule, RestaurantModule, OrganisationsModule],
  }).compile();
  const constants = moduleRef.get(ConstantsService);
  return { moduleRef, baseUrl: `http://localhost:${constants.private.BACKEND_PORT}`, constants };
}

export function httpClient(baseUrl: string) {
  const headers = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});
  return {
    get: (url: string, token?: string) => axios.get(`${baseUrl}${url}`, { headers: headers(token) }),
    post: (url: string, data: any, token?: string) => axios.post(`${baseUrl}${url}`, data, { headers: headers(token) }),
    patch: (url: string, data: any, token?: string) => axios.patch(`${baseUrl}${url}`, data, { headers: headers(token) }),
    delete: (url: string, token?: string, data?: any) => axios.delete(`${baseUrl}${url}`, { headers: headers(token), data }),
  };
}

/** The response whether the call succeeded or failed: a 4xx or 5xx does not throw. */
export async function call(fn: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
  try {
    return await fn();
  } catch (e: any) {
    if (!e.response) throw e;
    return e.response;
  }
}

/** Asserts the status, showing the body when it differs, and returns the response. */
export async function expectStatus(status: number, fn: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
  const res = await call(fn);
  if (res.status !== status) throw new Error(`Expected ${status}, got ${res.status}: ${JSON.stringify(res.data)}`);
  return res;
}

/** The date `offset` days from today, as YYYY-MM-DD. */
export const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

/** A session token for an existing account, through the real OTP flow. */
export async function login(moduleRef: TestingModule, baseUrl: string, email: string): Promise<string> {
  await moduleRef.get(EmailService).sendOtp(email);
  const { otp } = await moduleRef.get(AccountsService).findByUuid(`email:${email}`);
  const res = await axios.post(`${baseUrl}/oauth/callback`, { authType: 'email', email, otp });
  return res.data.token;
}

/** Creates an account with the role and signs it in through the real OTP flow. */
export async function signIn(moduleRef: TestingModule, baseUrl: string, email: string, role: AccountRole, extra: any = {}): Promise<Session> {
  const account = await moduleRef.get(AccountsService).create({ uuid: `email:${email}`, email, role, oauthMeta: {}, ...extra });
  return { id: account.id, email, token: await login(moduleRef, baseUrl, email), account };
}
