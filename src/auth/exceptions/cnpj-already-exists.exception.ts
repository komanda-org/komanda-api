import { HttpException, HttpStatus } from '@nestjs/common';

export class CnpjAlreadyExistsException extends HttpException {
  constructor() {
    super('CNPJ already exists', HttpStatus.CONFLICT);
  }
}
