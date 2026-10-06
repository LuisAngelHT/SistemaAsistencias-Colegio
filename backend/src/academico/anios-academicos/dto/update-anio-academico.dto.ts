import { PartialType } from '@nestjs/mapped-types';
import { CreateAnioAcademicoDto } from './create-anio-academico.dto';

export class UpdateAnioAcademicoDto extends PartialType(CreateAnioAcademicoDto) {}