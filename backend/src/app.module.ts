import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { CronModule } from './cron/cron.module';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { OAuthModule } from './oauth/oauth.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HotelsModule } from './hotels/hotels.module';
import { BookingsModule } from './bookings/bookings.module';
import { RequestsModule } from './requests/requests.module';
import { ChatModule } from './chat/chat.module';
import { MessagesModule } from './messages/messages.module';
import { ChatContextModule } from './chat-context/chat-context.module';
import { LangGraphModule } from './langgraph/langgraph.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { CostsModule } from './costs/costs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AgentJobsModule } from './agent-jobs/agent-jobs.module';
import { JwtMiddleware } from './auth/jwt.middleware';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'prod' ? path.join(__dirname, '..', 'prod.env') : path.join(__dirname, '..', 'dev.env'),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    CronModule,
    AccountsModule,
    AuthModule,
    OAuthModule,
    MailerModule,
    NotificationsModule,
    HotelsModule,
    BookingsModule,
    RequestsModule,
    ChatModule,
    MessagesModule,
    ChatContextModule,
    LangGraphModule,
    RestaurantModule,
    CostsModule,
    DashboardModule,
    IntegrationsModule,
    AgentJobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
