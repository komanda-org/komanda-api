import { PartialType } from '@nestjs/swagger';
import { CreateJobPostingDto } from './create-job-posting.dto';

// PATCH: os mesmos campos e validações da criação, todos opcionais.
// Vem do @nestjs/swagger (e não do @nestjs/mapped-types) para que a doc do
// Swagger também herde os campos, já marcados como opcionais.
// `status` não existe aqui de propósito: com forbidNonWhitelisted no
// ValidationPipe, mandar status no body da edição responde 400.
export class UpdateJobPostingDto extends PartialType(CreateJobPostingDto) {}
