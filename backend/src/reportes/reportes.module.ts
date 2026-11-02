import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaClase } from '../asistencia/clase/asistencia-clase.entity';
import { AsistenciaIngreso } from '../asistencia/ingreso/asistencia-ingreso.entity';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [TypeOrmModule.forFeature([AsistenciaIngreso, AsistenciaClase])],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
