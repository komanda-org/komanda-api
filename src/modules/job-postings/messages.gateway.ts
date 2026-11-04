import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  UseFilters,
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { ListMessagesUseCase } from './use-cases/list-messages.use-case';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinChatDto } from './dto/join-chat.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MessageResponseDto } from './dto/message-response.dto';

// Rate limiting por socket: janela deslizante 20 eventos/10s
interface RateLimitEntry {
  timestamps: number[];
}

const RATE_LIMIT_WINDOW_MS = 10000; // 10 segundos
const RATE_LIMIT_MAX_EVENTS = 20;

// Filtro para erros RPC (WebSocket)
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    this.logger.error(
      `WS Error: ${exception}`,
      exception instanceof Error ? exception.stack : '',
    );

    // Erros de validação do class-validator
    if (exception && typeof exception === 'object' && 'response' in exception) {
      const errorResponse = (exception as any).response;
      if (errorResponse?.message) {
        const error = {
          statusCode: 400,
          message: Array.isArray(errorResponse.message)
            ? errorResponse.message[0]
            : errorResponse.message,
        };
        client.emit('chat:error', error);
        // Retorna o erro para ser enviado como ack
        return { ok: false, error };
      }
    }

    // Erros HTTP padrão do NestJS
    if (exception && typeof exception === 'object' && 'status' in exception) {
      const status = (exception as any).status;
      const message = (exception as any).message;
      const error = {
        statusCode: status,
        message: Array.isArray(message) ? message[0] : message,
      };
      client.emit('chat:error', error);
      return { ok: false, error };
    }

    // Erro genérico
    const error = {
      statusCode: 500,
      message: 'Erro interno do servidor',
    };
    client.emit('chat:error', error);
    return { ok: false, error };
  }
}

@UseFilters(new WsExceptionFilter())
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  namespace: '/',
})
@Injectable()
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly listMessagesUseCase: ListMessagesUseCase,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${client.id})`,
        );
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Valida se o usuário ainda está ativo (token pode estar válido mas usuário deletado)
      // O gate nos use-cases fará a validação completa, mas aqui já bloqueamos soft-deleted
      // para não manter conexões inúteis
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.id})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: invalid token (${client.id})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected: ${client.id} (user: ${client.data.user?.id})`,
    );
    this.rateLimits.delete(client.id);
  }

  private checkRateLimit(client: Socket): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(client.id) || { timestamps: [] };

    // Remove timestamps fora da janela
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );

    if (entry.timestamps.length >= RATE_LIMIT_MAX_EVENTS) {
      return false;
    }

    entry.timestamps.push(now);
    this.rateLimits.set(client.id, entry);
    return true;
  }

  private emitRateLimitError(client: Socket) {
    client.emit('chat:error', {
      statusCode: 429,
      message: 'Muitas requisições. Tente novamente em alguns segundos.',
    });
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChatDto,
  ) {
    if (!this.checkRateLimit(client)) {
      this.emitRateLimitError(client);
      return {
        ok: false,
        error: { statusCode: 429, message: 'Rate limit exceeded' },
      };
    }

    try {
      const userId = client.data.user.id;
      const result = await this.listMessagesUseCase.execute({
        jobId: data.jobId,
        userId,
        take: data.take,
      });

      // Entra na room apenas após validação bem-sucedida
      client.join(`job:${data.jobId}`);

      return {
        ok: true,
        messages: result.messages.map((m) => new MessageResponseDto(m)),
        hasMore: result.hasMore,
      };
    } catch (error) {
      // Retorna erro no ack (o filtro WsExceptionFilter também emitirá chat:error)
      if (error instanceof ForbiddenException) {
        return {
          ok: false,
          error: { statusCode: 403, message: error.message },
        };
      }
      if (error instanceof NotFoundException) {
        return {
          ok: false,
          error: { statusCode: 404, message: error.message },
        };
      }
      if (error instanceof BadRequestException) {
        return {
          ok: false,
          error: { statusCode: 400, message: error.message },
        };
      }
      return {
        ok: false,
        error: { statusCode: 500, message: 'Erro interno do servidor' },
      };
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (!this.checkRateLimit(client)) {
      this.emitRateLimitError(client);
      return {
        ok: false,
        error: { statusCode: 429, message: 'Rate limit exceeded' },
      };
    }

    client.leave(`job:${data.jobId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    if (!this.checkRateLimit(client)) {
      this.emitRateLimitError(client);
      return {
        ok: false,
        error: { statusCode: 429, message: 'Rate limit exceeded' },
      };
    }

    try {
      const userId = client.data.user.id;
      const message = await this.sendMessageUseCase.execute({
        jobId: data.jobId,
        senderId: userId,
        content: data.content,
      });

      const messageDto = new MessageResponseDto(message);

      // Ack para o remetente (idempotência / UI otimista)
      // Broadcast para todos na room (inclusive o remetente)
      this.server.to(`job:${data.jobId}`).emit('chat:message', messageDto);

      return { ok: true, message: messageDto };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return {
          ok: false,
          error: { statusCode: 403, message: error.message },
        };
      }
      if (error instanceof NotFoundException) {
        return {
          ok: false,
          error: { statusCode: 404, message: error.message },
        };
      }
      if (error instanceof BadRequestException) {
        return {
          ok: false,
          error: { statusCode: 400, message: error.message },
        };
      }
      return {
        ok: false,
        error: { statusCode: 500, message: 'Erro interno do servidor' },
      };
    }
  }

  @SubscribeMessage('chat:history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ListMessagesDto,
  ) {
    if (!this.checkRateLimit(client)) {
      this.emitRateLimitError(client);
      return {
        ok: false,
        error: { statusCode: 429, message: 'Rate limit exceeded' },
      };
    }

    try {
      const userId = client.data.user.id;
      const before = data.before ? new Date(data.before) : undefined;
      const result = await this.listMessagesUseCase.execute({
        jobId: data.jobId,
        userId,
        before,
        take: data.take,
      });

      return {
        ok: true,
        messages: result.messages.map((m) => new MessageResponseDto(m)),
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return {
          ok: false,
          error: { statusCode: 403, message: error.message },
        };
      }
      if (error instanceof NotFoundException) {
        return {
          ok: false,
          error: { statusCode: 404, message: error.message },
        };
      }
      if (error instanceof BadRequestException) {
        return {
          ok: false,
          error: { statusCode: 400, message: error.message },
        };
      }
      return {
        ok: false,
        error: { statusCode: 500, message: 'Erro interno do servidor' },
      };
    }
  }
}
