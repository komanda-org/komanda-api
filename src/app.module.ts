import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { ProfessionalsModule } from './modules/professionals/Professionals.module';
import { RestaurantsModule } from './modules/restaurants/Restaurants.module';
import { VagasModule } from './modules/vagas/vagas.module';
import { JobsModule } from './modules/jobs/Jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    AuthModule,
    PrismaModule,
    ProfessionalsModule,
    RestaurantsModule,
    VagasModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
