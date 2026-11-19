import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { RestaurantPublicProfileResponseDto } from './dto/restaurant-public-profile-response.dto';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';
import { GetRestaurantPublicProfileUseCase } from './use-cases/get-restaurant-public-profile.use-case';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly registerRestaurantUseCase: RegisterRestaurantUseCase,
    private readonly getRestaurantPublicProfile: GetRestaurantPublicProfileUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar restaurante' })
  @ApiResponse({ status: 201, description: 'Restaurante criado com sucesso' })
  async create(@Body() dto: CreateRestaurantDto) {
    return await this.registerRestaurantUseCase.execute(dto);
  }

  @Get(':id')
  @SkipThrottle() // leitura autenticada de tela; ver notifications.controller
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil público do restaurante',
    description:
      'Dados do restaurante, nota média e vagas abertas. Qualquer usuário logado. Não expõe CNPJ, e-mail nem plano.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'users.id do restaurante',
  })
  @ApiOkResponse({ type: RestaurantPublicProfileResponseDto })
  @ApiResponse({ status: 400, description: 'id não é um UUID' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Restaurante não encontrado' })
  async getPublicProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RestaurantPublicProfileResponseDto> {
    return this.getRestaurantPublicProfile.execute(id);
  }
}
