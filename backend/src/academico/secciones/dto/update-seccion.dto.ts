import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSeccionDto } from './create-seccion.dto';

// El año académico de una sección no se cambia
export class UpdateSeccionDto extends PartialType(
  OmitType(CreateSeccionDto, ['anioAcademicoId'] as const),
) {}