import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AccesoFamiliarController, PortalFamiliarController, SolicitudesJustificacionController,
} from './portal-familiar.controller';
import { PortalFamiliarService } from './portal-familiar.service';
import { Matricula } from '../matriculas/matricula.entity';
import { AsistenciaIngreso } from '../asistencia/ingreso/asistencia-ingreso.entity';
import { SolicitudJustificacion } from './solicitud-justificacion.entity';
import { Alumno } from '../alumnos/alumno.entity';
import { AsistenciaClase } from '../asistencia/clase/asistencia-clase.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    Matricula, AsistenciaIngreso, AsistenciaClase, SolicitudJustificacion, Alumno,
  ])],
  controllers: [
    AccesoFamiliarController, PortalFamiliarController, SolicitudesJustificacionController,
  ],
  providers: [PortalFamiliarService],
  exports: [PortalFamiliarService],
})
export class PortalFamiliarModule {}
