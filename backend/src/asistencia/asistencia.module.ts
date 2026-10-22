import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlumnoModule } from '../alumnos/alumno.module';
import { MatriculaModule } from '../matriculas/matricula.module';
import { AsistenciaIngreso } from './ingreso/asistencia-ingreso.entity';
import { AsistenciaIngresoService } from './ingreso/asistencia-ingreso.service';
import { AsistenciaIngresoController } from './ingreso/asistencia-ingreso.controller';
import { HorarioModule } from '../horarios/horario.module';
import { AsistenciaClase } from './clase/asistencia-clase.entity';
import { AsistenciaClaseService } from './clase/asistencia-clase.service';
import { AsistenciaClaseController } from './clase/asistencia-clase.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AsistenciaIngreso, AsistenciaClase]),
    MatriculaModule,
    AlumnoModule,
    HorarioModule,
  ],
  controllers: [AsistenciaIngresoController, AsistenciaClaseController],
  providers: [AsistenciaIngresoService, AsistenciaClaseService],
  exports: [AsistenciaIngresoService, AsistenciaClaseService],
})
export class AsistenciaModule {}
