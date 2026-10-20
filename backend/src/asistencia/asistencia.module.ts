import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlumnoModule } from '../alumnos/alumno.module';
import { MatriculaModule } from '../matriculas/matricula.module';
import { AsistenciaIngreso } from './ingreso/asistencia-ingreso.entity';
import { AsistenciaIngresoService } from './ingreso/asistencia-ingreso.service';
import { AsistenciaIngresoController } from './ingreso/asistencia-ingreso.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AsistenciaIngreso]), MatriculaModule, AlumnoModule],
  controllers: [AsistenciaIngresoController],
  providers: [AsistenciaIngresoService],
  exports: [AsistenciaIngresoService],
})
export class AsistenciaModule {}
