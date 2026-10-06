import { BadRequestException, ConflictException } from '@nestjs/common';

export function handleDbError(
  e: any,
  msgs: { unique?: string; fk?: string } = {},
): never {
  if (e?.code === '23505') {
    throw new ConflictException(msgs.unique ?? 'Registro duplicado');
  }
  if (e?.code === '23503') {
    throw new ConflictException(msgs.fk ?? 'Referencia inválida o registro en uso');
  }
  if (e?.code === '23514') {
    throw new BadRequestException('Datos inválidos');
  }
  throw e;
}