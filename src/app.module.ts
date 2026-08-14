import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { ProfessionalsModule } from './modules/professionals/Professionals.module';
import { RestaurantsModule } from './modules/restaurants/Restaurants.module';
import { JobPostingsModule } from './modules/job-postings/job-postings.module';
import { JobsModule } from './modules/jobs/Jobs.module';
import { UsersModule } from './modules/users/users.module';

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
    JobPostingsModule,
    JobsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
