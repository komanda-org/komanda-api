import { Module } from '@nestjs/common';
import { RestaurantsController } from './Restaurants.controller';
import { MyJobsController } from './MyJobs.controller';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';
import { ListMyJobsUseCase } from './use-cases/list-my-jobs.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [RestaurantsController, MyJobsController],
    providers: [RegisterRestaurantUseCase, ListMyJobsUseCase]
})

export class RestaurantsModule { }
