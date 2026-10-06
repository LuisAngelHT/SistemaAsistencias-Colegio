import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioModule } from '../usuarios/usuario.module';
import { AnioAcademico } from './anios-academicos/anio-academico.entity';
import { AnioAcademicoService } from './anios-academicos/anio-academico.service';
import { AnioAcademicoController } from './anios-academicos/anio-academico.controller';
import { Grado } from './grados/grado.entity';
import { GradoService } from './grados/grado.service';
import { GradoController } from './grados/grado.controller';
import { Curso } from './cursos/curso.entity';
import { CursoService } from './cursos/curso.service';
import { CursoController } from './cursos/curso.controller';
import { Seccion } from './secciones/seccion.entity';
import { SeccionService } from './secciones/seccion.service';
import { SeccionController } from './secciones/seccion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnioAcademico, Grado, Curso, Seccion]), UsuarioModule],
  controllers: [AnioAcademicoController, GradoController, CursoController, SeccionController],
  providers: [AnioAcademicoService, GradoService, CursoService, SeccionService],
  exports: [AnioAcademicoService, GradoService, CursoService, SeccionService],
})
export class AcademicoModule {}