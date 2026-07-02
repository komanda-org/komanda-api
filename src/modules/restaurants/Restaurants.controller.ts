import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';

@Controller('restaurantes')
export class RestaurantsController {

    constructor(
        private readonly registerRestaurantUseCase: RegisterRestaurantUseCase
    ) { }

    @Post('cadastro')
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CreateRestaurantDto) {
        return await this.registerRestaurantUseCase.execute(dto);
    }
}
