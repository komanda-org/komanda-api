import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly registerRestaurantUseCase: RegisterRestaurantUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar restaurante' })
  @ApiResponse({ status: 201, description: 'Restaurante criado com sucesso' })
  async create(@Body() dto: CreateRestaurantDto) {
    return await this.registerRestaurantUseCase.execute(dto);
  }
}
