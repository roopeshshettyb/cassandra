/**
 * Every API route's access rule, read from the decorators Nest enforces.
 * A route that loses its login or admin guard fails here before it reaches review.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { AdminGuard } from '../../src/auth/guards/admin.guard';
import { IntegrationAuthGuard } from '../../src/integrations/integration-auth.guard';
import { AccountsController } from '../../src/accounts/accounts.controller';
import { AppController } from '../../src/app.controller';
import { AuthController } from '../../src/auth/auth.controller';
import { InviteController } from '../../src/auth/invite.controller';
import { BookingsController } from '../../src/bookings/bookings.controller';
import { ConstantsController } from '../../src/common/constants/constants.controller';
import { CostsController } from '../../src/costs/costs.controller';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { HotelsController } from '../../src/hotels/hotels.controller';
import { HotelIntegrationsController } from '../../src/integrations/hotel-integrations.controller';
import { IntegrationsWebhookController } from '../../src/integrations/integrations.webhook.controller';
import { NotificationsController } from '../../src/notifications/notifications.controller';
import { OAuthController } from '../../src/oauth/oauth.controller';
import { OrganisationsController, OrganisationUsersController } from '../../src/organisations/organisations.controller';
import { RequestsController } from '../../src/requests/requests.controller';
import { RestaurantController } from '../../src/restaurant/restaurant.controller';
import { RoomsController } from '../../src/rooms/rooms.controller';

const CONTROLLERS: any[] = [
  AccountsController,
  AppController,
  AuthController,
  InviteController,
  BookingsController,
  ConstantsController,
  CostsController,
  DashboardController,
  HotelsController,
  HotelIntegrationsController,
  IntegrationsWebhookController,
  NotificationsController,
  OAuthController,
  OrganisationsController,
  OrganisationUsersController,
  RequestsController,
  RestaurantController,
  RoomsController,
];

const PUBLIC = ['GET /', 'GET /health', 'GET /constants/public', 'POST /invite', 'POST /oauth/callback', 'POST /oauth/email/send-otp'];

const ADMIN_ONLY = [
  'GET /hotels/brands',
  'GET /hotels/brands/filters',
  'GET /hotels/brands/:brandId',
  'DELETE /hotels/brands/:brandId',
  'DELETE /hotels/:id',
  'POST /hotels/:id/access',
  'DELETE /hotels/:id/access/:accountId',
  'POST /bookings/send-pending-invites',
  'POST /organisations',
  'PATCH /organisations/:id',
  'DELETE /organisations/:id',
];

const INTEGRATION_TOKEN = ['POST /integrations/v1/bookings', 'POST /integrations/v1/requests', 'POST /integrations/providers/:provider/webhooks'];

// Public today, and should not be — see test/README.md. These tests start passing once they are guarded.
const SHOULD_NOT_BE_PUBLIC = ['POST /accounts', 'GET /accounts/count'];

interface Route {
  name: string;
  key: string;
  guards: any[];
}

function join(...parts: string[]): string {
  return (
    '/' +
    parts
      .map((p) => p.replace(/^\/|\/$/g, ''))
      .filter(Boolean)
      .join('/')
  );
}

function routesOf(controller: any): Route[] {
  const prefix = Reflect.getMetadata(PATH_METADATA, controller);
  const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) || [];
  const routes: Route[] = [];
  for (const key of Object.getOwnPropertyNames(controller.prototype)) {
    const handler = controller.prototype[key];
    const subPath = Reflect.getMetadata(PATH_METADATA, handler);
    if (key === 'constructor' || subPath === undefined) continue;
    const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
    routes.push({ name: `${method} ${join(prefix, subPath)}`, key, guards: [...classGuards, ...(Reflect.getMetadata(GUARDS_METADATA, handler) || [])] });
  }
  return routes;
}

const ROUTES = CONTROLLERS.flatMap(routesOf);
const byName = (name: string) => ROUTES.find((r) => r.name === name);

/** Every file under src. */
function srcFiles(dir = path.join(__dirname, '../../src')): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe('route access', () => {
  it('covers every controller in src (the unregistered sample module aside)', () => {
    const declared = srcFiles()
      .filter((f) => f.endsWith('.controller.ts') && path.basename(f) !== 'sample.controller.ts')
      .flatMap((f) => fs.readFileSync(f, 'utf8').match(/(?<=export class )\w+Controller/g) || []);
    expect(declared.sort()).toEqual(CONTROLLERS.map((c) => c.name).sort());
  });

  it('lists every route exactly once', () => {
    const names = ROUTES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of [...PUBLIC, ...ADMIN_ONLY, ...INTEGRATION_TOKEN, ...SHOULD_NOT_BE_PUBLIC]) expect(names).toContain(name);
  });

  it.each(PUBLIC)('%s is public', (name) => {
    expect(byName(name).guards).toEqual([]);
  });

  it.each(INTEGRATION_TOKEN)('%s needs an integration token, not a session', (name) => {
    expect(byName(name).guards).toEqual([IntegrationAuthGuard]);
  });

  it.each(ADMIN_ONLY)('%s needs an admin session', (name) => {
    expect(byName(name).guards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });

  const sessionRoutes = ROUTES.filter((r) => ![...PUBLIC, ...ADMIN_ONLY, ...INTEGRATION_TOKEN, ...SHOULD_NOT_BE_PUBLIC].includes(r.name));
  it.each(sessionRoutes.map((r) => r.name))('%s needs a session, any role', (name) => {
    expect(byName(name).guards).toEqual([JwtAuthGuard]);
  });

  test.failing.each(SHOULD_NOT_BE_PUBLIC)('%s needs a session', (name) => {
    expect(byName(name).guards).toContain(JwtAuthGuard);
  });
});
