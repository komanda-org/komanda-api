import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import {
  type MeResponseDto,
  MyProfessionalMeResponseDto,
  MyRestaurantMeResponseDto,
} from './dto/my-restaurant-profile-response.dto';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { ReqUser } from './req-user.decorator';
import {
  UpdateMyProfileUseCase,
  type UpdatedProfileResponse,
} from '../users/use-cases/update-my-profile.use-case';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';
import type { UpdateProfileDto } from './update-user.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly getMyProfile: GetMyProfileUseCase,
    private readonly updateMyProfile: UpdateMyProfileUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
  ) {}

  @Get('me')
  @SkipThrottle() // leitura autenticada de tela; ver notifications.controller
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil do usuário logado (profissional ou restaurante)',
    description:
      'O formato depende do role do token; o campo `role` indica qual chegou.',
  })
  @ApiExtraModels(MyProfessionalMeResponseDto, MyRestaurantMeResponseDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(MyProfessionalMeResponseDto) },
        { $ref: getSchemaPath(MyRestaurantMeResponseDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente ou inválido' })
  @ApiNotFoundResponse({ description: 'Cadastro não existe ou foi excluído' })
  async getMe(@ReqUser() user: JwtPayload): Promise<MeResponseDto> {
    // id e role vêm só do token; a rota não aceita id, query nem body.
    return this.getMyProfile.execute(user);
  }

  @Put('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Editar meu perfil (profissional ou restaurante)',
    description:
      'Só os campos enviados mudam. O formato aceito depende do role do token.',
  })
  @ApiOkResponse({ description: 'Perfil atualizado' })
  @ApiBadRequestResponse({ description: 'Campo inválido ou não permitido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente ou inválido' })
  async updateMe(
    @ReqUser() user: JwtPayload,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UpdatedProfileResponse> {
    return this.updateMyProfile.execute({
      user,
      payload: updateProfileDto,
    });
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Excluir minha conta',
    description: 'A conta perde o acesso na hora e some das buscas.',
  })
  @ApiNoContentResponse({ description: 'Conta excluída' })
  @ApiNotFoundResponse({ description: 'Conta já excluída' })
  async deleteAccount(@ReqUser() user: JwtPayload): Promise<void> {
    await this.deleteAccountUseCase.execute(user.id);
  }
}
