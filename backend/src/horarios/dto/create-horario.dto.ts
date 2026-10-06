import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateHorarioDto {
  @IsInt() seccionId: number;
  @IsInt() cursoId: number;
  @IsUUID() profesorId: string;

  @IsInt() @Min(1) @Max(7)
  diaSemana: number; // 1 = lunes ... 7 = domingo

  @Matches(HORA, { message: 'horaInicio debe ser HH:mm' })
  horaInicio: string;

  @Matches(HORA, { message: 'horaFin debe ser HH:mm' })
  horaFin: string;
}