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
 *
 * As variáveis de ambiente que o ConfigModule exige são setadas em
 * test/jest-setup-env.ts, e não aqui: o `ConfigModule.forRoot()` do AppModule
 * roda na avaliação do decorator, ou seja, já no `import` da linha 2 — antes de
 * qualquer beforeAll.
 */
describe('AppModule', () => {
  it('resolve todas as dependências, incluindo os guards dos controllers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeDefined();

    await moduleRef.close();
  });
});
