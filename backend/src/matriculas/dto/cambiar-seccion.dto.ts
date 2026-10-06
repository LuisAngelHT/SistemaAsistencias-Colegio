import { IsInt } from 'class-validator';

export class CambiarSeccionDto {
  @IsInt() seccionId: number;
}