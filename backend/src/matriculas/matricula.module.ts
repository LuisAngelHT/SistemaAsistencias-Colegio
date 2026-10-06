import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicoModule } from '../academico/academico.module';
import { AlumnoModule } from '../alumnos/alumno.module';
import { Matricula } from './matricula.entity';
import { MatriculaService } from './matricula.service';
import { MatriculaController } from './matricula.controller';
import { HorarioModule } from '../horarios/horario.module';

@Module({
  imports: [TypeOrmModule.forFeature([Matricula]), AlumnoModule, AcademicoModule, HorarioModule],
  controllers: [MatriculaController],
  providers: [MatriculaService],
  exports: [MatriculaService],
})
export class MatriculaModule {}