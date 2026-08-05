import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestPasswordRecoveryUseCase: RequestPasswordRecoveryUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Realizar login' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post('recuperar-senha')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recuperar senha' })
  @ApiResponse({ status: 200, description: 'Instruções enviadas' })
  async recoverPassword(@Body() dto: RecoverPasswordDto) {
    await this.requestPasswordRecoveryUseCase.execute(dto);

    return {
      message:
        'Se o e-mail constar em nossa base, as instruções foram enviadas',
    };
  }

  @Post('resetar-senha')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resetar senha' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto);

    return { message: 'Senha alterada com sucesso, se o token for válido' };
  }
}
