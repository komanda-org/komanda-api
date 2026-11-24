import { Module } from '@nestjs/common';
import { RestaurantsController } from './Restaurants.controller';
import { MyJobsController } from './MyJobs.controller';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';
import { ListMyJobsUseCase } from './use-cases/list-my-jobs.use-case';
import { GetRestaurantPublicProfileUseCase } from './use-cases/get-restaurant-public-profile.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { GeocodingModule } from 'src/common/geocoding/geocoding.module';

@Module({
  imports: [PrismaModule, AuthModule, GeocodingModule],
  controllers: [RestaurantsController, MyJobsController],
  providers: [
    RegisterRestaurantUseCase,
    ListMyJobsUseCase,
    GetRestaurantPublicProfileUseCase,
  ],
})
export class RestaurantsModule {}
