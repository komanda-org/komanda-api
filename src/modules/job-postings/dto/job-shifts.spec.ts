import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { JobShift } from '@prisma/client';
import { CreateJobPostingDto } from './create-job-posting.dto';
import { UpdateJobPostingDto } from './update-job-posting.dto';

// Mesmo pipe de src/main.ts.
describe('shifts (turnos da vaga) no cadastro e na edição', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validJob = {
    title: 'Garçom para eventos',
    description: 'Atendimento no salão em eventos e jantares da casa.',
    contractType: 'CLT',
  };

  describe.each([
    ['CreateJobPostingDto (POST /jobs)', CreateJobPostingDto, validJob],
    ['UpdateJobPostingDto (PATCH /jobs/:id)', UpdateJobPostingDto, {}],
  ])('%s', (_name, metatype, base) => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype,
      data: undefined,
    };
    const run = (body: Record<string, unknown>) =>
      pipe.transform({ ...base, ...body }, metadata) as Promise<{
        shifts?: JobShift[];
      }>;

    it('aceita mais de um turno e normaliza (trim + maiúsculas)', async () => {
      const result = await run({ shifts: [' manha ', 'Tarde'] });
      expect(result.shifts).toEqual([JobShift.MANHA, JobShift.TARDE]);
    });

    it('aceita INTEGRAL sozinho', async () => {
      const result = await run({ shifts: ['INTEGRAL'] });
      expect(result.shifts).toEqual([JobShift.INTEGRAL]);
    });

    it('null vira [] (apaga os turnos) e [] continua válido', async () => {
      expect((await run({ shifts: null })).shifts).toEqual([]);
      expect((await run({ shifts: [] })).shifts).toEqual([]);
    });

    it('omitido continua omitido', async () => {
      expect((await run({})).shifts).toBeUndefined();
    });

    it.each([
      ['INTEGRAL com outro turno', ['INTEGRAL', 'MANHA']],
      ['turno repetido', ['MANHA', 'manha']],
      ['MADRUGADA (saiu da lista)', ['MADRUGADA']],
      ['texto em vez de lista', 'MANHA'],
      ['item que não é texto', [1]],
    ])('rejeita com 400: %s', async (_case, shifts) => {
      await expect(run({ shifts })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('o campo antigo "shift" não é mais aceito', async () => {
      await expect(run({ shift: 'NOITE' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
