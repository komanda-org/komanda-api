import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
        errorMessage: 'Muitas tentativas. Tente novamente em alguns minutos.',
        // O guard global também roda em gateways WebSocket; throttle é só HTTP.
        skipIf: (context) => context.getType() !== 'http',
        throttlers: [
          {
            // Limite padrão para toda a API. Rotas sensíveis (login,
            // recuperação de senha, cadastros, denúncias) sobrescrevem com
            // @Throttle e limites bem menores.
            name: 'default',
            limit: Number(configService.get<number>('RATE_LIMIT') ?? 20),
            ttl:
              Number(
                configService.get<number>('RATE_LIMIT_TTL_SECONDS') ?? 60,
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
  providers: [
    AppService,
    // Throttle global: nenhuma rota fica sem limite. As rotas sensíveis
    // apertam o limite com @Throttle.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
