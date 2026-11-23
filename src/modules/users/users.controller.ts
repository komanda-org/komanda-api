import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  MAX_PHOTO_BYTES,
  UpdateMyPhotoUseCase,
  type PhotoResponse,
  type UploadedPhoto,
} from './use-cases/update-my-photo.use-case';
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
    private readonly updateMyPhoto: UpdateMyPhotoUseCase,
  ) {}

  @Post('me/photo')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @ApiBearerAuth()
  @UseInterceptors(
    // +1 byte: o multer recusa com 413 só acima disso; o use case dá a mensagem.
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES + 1, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Enviar foto de perfil (profissional) ou logo (restaurante)',
    description:
      'multipart/form-data, campo "file". JPG, PNG ou WEBP, até 5 MB. A imagem já deve chegar recortada; substitui a anterior.',
  })
  @ApiOkResponse({ description: '{ url }: nova URL da foto' })
  @ApiBadRequestResponse({
    description: 'Sem arquivo, formato inválido ou acima de 5 MB',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente ou inválido' })
  async uploadPhoto(
    @ReqUser() user: JwtPayload,
    @UploadedFile() file: UploadedPhoto | undefined,
  ): Promise<PhotoResponse> {
    return this.updateMyPhoto.upload(user, file);
  }

  @Delete('me/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover foto de perfil / logo' })
  @ApiNoContentResponse({ description: 'Foto removida' })
  async removePhoto(@ReqUser() user: JwtPayload): Promise<void> {
    await this.updateMyPhoto.remove(user);
  }

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
