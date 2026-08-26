import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { ReqUser } from './req-user.decorator';
import {
  UpdateMyProfileUseCase,
  type UpdatedProfileResponse,
} from '../users/use-cases/update-my-profile.use-case';
import type { UpdateProfileDto } from './update-user.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly updateMyProfile: UpdateMyProfileUseCase) {}

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
}
