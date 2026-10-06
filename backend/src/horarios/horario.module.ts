import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicoModule } from '../academico/academico.module';
import { UsuarioModule } from '../usuarios/usuario.module';
import { Horario } from './horario.entity';
import { HorarioService } from './horario.service';
import { HorarioController } from './horario.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Horario]), AcademicoModule, UsuarioModule],
  controllers: [HorarioController],
  providers: [HorarioService],
  exports: [HorarioService],
})
export class HorarioModule {}