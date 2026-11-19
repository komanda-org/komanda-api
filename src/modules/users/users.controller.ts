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
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { ReqUser } from './req-user.decorator';
import {
  UpdateMyProfileUseCase,
  type UpdatedProfileResponse,
} from '../users/use-cases/update-my-profile.use-case';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';
import type { UpdateProfileDto } from './update-user.dto';

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
  @Roles(Role.PROFISSIONAL)
  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do profissional logado' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente ou inválido' })
  @ApiForbiddenResponse({ description: 'Usuário logado não é profissional' })
  @ApiNotFoundResponse({ description: 'Cadastro de profissional não existe' })
  async getMe(@ReqUser() user: JwtPayload): Promise<MyProfileResponseDto> {
    // O id vem só do token; a rota não aceita id, query nem body.
    return this.getMyProfile.execute(user.id);
  }

  @Put('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
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
  async deleteAccount(@ReqUser() user: JwtPayload): Promise<void> {
    await this.deleteAccountUseCase.execute(user.id);
  }
}
