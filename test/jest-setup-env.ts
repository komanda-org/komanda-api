/**
 * Roda ANTES de qualquer módulo de teste ser importado (jest `setupFiles`).
 *
 * O AppModule chama `ConfigModule.forRoot({ validationSchema })` dentro do
 * decorator @Module. Isso não é preguiçoso: a chamada executa — e o Joi valida —
 * no instante em que `app.module.ts` é *importado*, muito antes de qualquer
 * `beforeAll` do spec rodar. Setar process.env lá dentro é tarde demais.
 *
 * Na máquina do dev passa porque existe um `.env` em disco, que o ConfigModule
 * lê. Como `.env` está no .gitignore, o CI não tem nenhum — e a suíte quebrava
 * só lá. Estes defaults valem para qualquer ambiente sem `.env`; se a variável
 * já existir (dev local ou secret do CI), ela é respeitada.
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-jwt-secret-0123456789abcdef';
process.env.AUTH_LOGIN_LIMIT = process.env.AUTH_LOGIN_LIMIT ?? '2';
process.env.AUTH_LOGIN_TTL_SECONDS = process.env.AUTH_LOGIN_TTL_SECONDS ?? '60';
process.env.PASSWORD_RESET_TOKEN_PEPPER =
  process.env.PASSWORD_RESET_TOKEN_PEPPER ??
  'test-pepper-secret-0123456789abcdef';
// Testes nunca chamam BrasilAPI/Nominatim.
process.env.GEOCODING_ENABLED = process.env.GEOCODING_ENABLED ?? 'false';
