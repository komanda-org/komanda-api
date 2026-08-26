import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestPasswordRecoveryUseCase: RequestPasswordRecoveryUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) { }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    login: {
      limit: () => Number(process.env.AUTH_LOGIN_LIMIT ?? 5),
      ttl: () => Number(process.env.AUTH_LOGIN_TTL_SECONDS ?? 60) * 1000,
    },
  })
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post('recuperar-senha')
  @HttpCode(200)
  async recoverPassword(@Body() dto: RecoverPasswordDto) {
    await this.requestPasswordRecoveryUseCase.execute(dto);

    return {
      message: 'Se o e-mail constar em nossa base, as instruções foram enviadas',
    };
  }

  @Post('resetar-senha')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto);

    return { message: 'Senha alterada com sucesso, se o token for válido' };
  }
}
