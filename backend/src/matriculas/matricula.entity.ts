import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Alumno } from '../alumnos/alumno.entity';
import { Seccion } from '../academico/secciones/seccion.entity';

export enum EstadoMatricula {
  ACTIVA = 'activa',
  RETIRADA = 'retirada',
  TRASLADADA = 'trasladada',
  FINALIZADA = 'finalizada',
}

@Entity({ schema: 'public', name: 'matriculas' })
export class Matricula {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alumno_id', type: 'uuid' })
  alumnoId: string;

  @ManyToOne(() => Alumno)
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;

  @Column({ name: 'seccion_id', type: 'int' })
  seccionId: number;

  @ManyToOne(() => Seccion)
  @JoinColumn({ name: 'seccion_id' })
  seccion: Seccion;

  @Column({ name: 'anio_academico_id', type: 'smallint' })
  anioAcademicoId: number;

  @Column({
    type: 'enum',
    enum: EstadoMatricula,
    enumName: 'estado_matricula',
    default: EstadoMatricula.ACTIVA,
  })
  estado: EstadoMatricula;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}