import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { StripeModule } from './common/stripe/stripe.module';
import { CaptchaModule } from './common/captcha/captcha.module';
import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BetsModule } from './modules/bets/bets.module';
import { AdminModule } from './modules/admin/admin.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PacksModule } from './modules/packs/packs.module';
import { StatisticsModule } from './modules/statistics/statistics.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Task scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Structured logging with Pino
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: true,
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              headers: {
                'user-agent': req.headers['user-agent'],
              },
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds
        limit: 600, // 600 requests per minute (10req/s)
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 20, // Stricter for auth endpoints
      },
    ]),

    // Database
    DatabaseModule,

    // Security audit logging
    SecurityModule,

    // Stripe payments
    StripeModule,

    // CAPTCHA verification
    CaptchaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    BetsModule,
    AdminModule,
    WebhooksModule,
    DashboardModule,
    CategoriesModule,
    PacksModule,
    StatisticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
