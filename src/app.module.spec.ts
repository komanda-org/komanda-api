import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Este teste só compila o grafo de DI (não abre conexão com o banco: `compile()`
 * não dispara o onModuleInit do PrismaService).
 *
 * Ele existe porque os specs de controller dão `.overrideGuard(...)` nos guards,
 * então nunca exercitam a injeção real do AuthGuard. Um guard preso via
 * `@UseGuards(AuthGuard)` é instanciado no contexto do módulo *que o usa*, logo
 * o JwtService precisa estar resolvível lá — se algum módulo esquecer disso, a
 * aplicação quebra no boot e nenhum teste unitário percebe. Este aqui percebe.
 */
describe('AppModule', () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/test';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  });

  it('resolve todas as dependências, incluindo os guards dos controllers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeDefined();

    await moduleRef.close();
  });
});
