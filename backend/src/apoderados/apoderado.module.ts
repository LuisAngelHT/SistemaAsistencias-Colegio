import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apoderado } from './apoderado.entity';
import { AlumnoApoderado } from './alumno-apoderado.entity';
import { ApoderadoService } from './apoderado.service';
import { ApoderadoController } from './apoderado.controller';
import { AlumnoApoderadosController } from './alumno-apoderados.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Apoderado, AlumnoApoderado])],
  controllers: [ApoderadoController, AlumnoApoderadosController],
  providers: [ApoderadoService],
  exports: [ApoderadoService],
})
export class ApoderadoModule {}