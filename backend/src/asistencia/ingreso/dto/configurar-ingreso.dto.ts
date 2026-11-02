import { IsInt, Matches, Max, Min } from 'class-validator';

export class ConfigurarIngresoDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaIngreso debe tener formato HH:mm' })
  horaIngreso: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaLimite debe tener formato HH:mm' })
  horaLimite: string;

  @IsInt()
  @Min(0)
  @Max(180)
  toleranciaMin: number;
}
