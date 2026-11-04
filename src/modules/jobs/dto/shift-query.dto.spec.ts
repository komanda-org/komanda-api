import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ListJobsQueryDto } from './list-jobs-query.dto';
import { SearchJobsQueryDto } from './search-jobs-query.dto';

// Mesmo pipe de src/main.ts: com forbidNonWhitelisted, um ?shift= fora do
// DTO daria 400 — por isso testamos o contrato da query isoladamente.
describe('shift nos DTOs de query de vagas', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadataFor = (
    metatype: ArgumentMetadata['metatype'],
  ): ArgumentMetadata => ({ type: 'query', metatype, data: undefined });

  describe.each([
    ['ListJobsQueryDto (GET /jobs)', ListJobsQueryDto],
    ['SearchJobsQueryDto (GET /jobs/search)', SearchJobsQueryDto],
  ])('%s', (_name, dto) => {
    const metadata = metadataFor(dto);

    it('aceita ?shift= e normaliza com trim + maiúsculas', async () => {
      const result = (await pipe.transform({ shift: ' noite ' }, metadata)) as {
        shift?: string;
      };
      expect(result.shift).toBe('NOITE');
    });

    it('trata shift em branco como ausente (sem filtro)', async () => {
      const result = (await pipe.transform({ shift: '   ' }, metadata)) as {
        shift?: string;
      };
      expect(result.shift).toBeUndefined();
    });

    it('sem shift continua válido (sem regressão)', async () => {
      const result = (await pipe.transform({}, metadata)) as {
        shift?: string;
      };
      expect(result.shift).toBeUndefined();
    });

    it('rejeita shift acima de 30 caracteres', async () => {
      await expect(
        pipe.transform({ shift: 'x'.repeat(31) }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
