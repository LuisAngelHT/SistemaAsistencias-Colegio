import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Seccion } from '../academico/secciones/seccion.entity';
import { Curso } from '../academico/cursos/curso.entity';
import { Usuario } from '../usuarios/usuario.entity';

@Entity({ schema: 'public', name: 'horarios' })
export class Horario {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'seccion_id', type: 'int' })
  seccionId: number;

  @ManyToOne(() => Seccion)
  @JoinColumn({ name: 'seccion_id' })
  seccion: Seccion;

  @Column({ name: 'curso_id', type: 'int' })
  cursoId: number;

  @ManyToOne(() => Curso)
  @JoinColumn({ name: 'curso_id' })
  curso: Curso;

  @Column({ name: 'profesor_id', type: 'uuid' })
  profesorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'profesor_id' })
  profesor: Usuario;

  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}