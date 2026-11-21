import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { ListNotificationsUseCase } from './use-cases/list-notifications.use-case';
import { MarkAsReadUseCase } from './use-cases/mark-as-read.use-case';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markAsReadUseCase: MarkAsReadUseCase,
  ) {}

  // Leitura autenticada chamada em toda tela (sino); o limite global de
  // 20/min derrubava o front com 429.
  @Get('me/notifications')
  @SkipThrottle()
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @ApiOperation({
    summary: 'Listar minhas notificações (mais recentes primeiro)',
  })
  @ApiResponse({ status: 200, description: 'Página de notificações' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  async list(
    @Query() query: ListNotificationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listNotifications.execute({
      userId: req.user.id,
      skip: query.skip ?? 0,
      take: query.take ?? 20,
    });
  }

  @Patch('me/notifications/:id/read')
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @ApiOperation({ summary: 'Marcar uma notificação como lida' })
  @ApiParam({ name: 'id', description: 'id da notificação' })
  @ApiResponse({ status: 200, description: 'Notificação marcada como lida' })
  @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.markAsReadUseCase.execute({
      id,
      userId: req.user.id,
    });
  }
}
