import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Atrás de proxy (Traefik/Nginx) o IP do socket é o do proxy; sem isto todo
  // mundo compartilha o mesmo balde de rate limit. 0 = não confia em proxy.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  app.set('trust proxy', trustProxyHops);

  if (process.env.NODE_ENV === 'production' && trustProxyHops === 0) {
    Logger.warn(
      'TRUST_PROXY_HOPS=0: se a API estiver atrás de proxy (Traefik/Nginx/Cloudflare), todos os clientes compartilharão o mesmo IP no rate limit. Configure TRUST_PROXY_HOPS com o número de proxies à frente da aplicação.',
      'Bootstrap',
    );
  }

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Komanda API')
    .setDescription('API para marketplace de restaurantes e profissionais')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
