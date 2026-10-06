import { IsInt, IsUUID } from 'class-validator';

export class CreateMatriculaDto {
  @IsUUID() alumnoId: string;
  @IsInt() seccionId: number;
}