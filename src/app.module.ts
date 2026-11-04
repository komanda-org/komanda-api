import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { ProfessionalsModule } from './modules/professionals/Professionals.module';
import { RestaurantsModule } from './modules/restaurants/Restaurants.module';
import { JobPostingsModule } from './modules/job-postings/job-postings.module';
import { JobsModule } from './modules/jobs/Jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { ReviewsModule } from './modules/reviews/Reviews.module';
import { DenunciasModule } from './modules/denuncias/Denuncias.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage:
          'Muitas tentativas de login. Tente novamente em alguns minutos.',
        throttlers: [
          {
            name: 'login',
            limit: Number(configService.get<number>('AUTH_LOGIN_LIMIT') ?? 5),
            ttl:
              Number(
                configService.get<number>('AUTH_LOGIN_TTL_SECONDS') ?? 60,
              ) * 1000,
          },
        ],
      }),
    }),
    AuthModule,
    PrismaModule,
    ProfessionalsModule,
    RestaurantsModule,
    JobPostingsModule,
    JobsModule,
    NotificationsModule,
    UsersModule,
    ReviewsModule,
    DenunciasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
