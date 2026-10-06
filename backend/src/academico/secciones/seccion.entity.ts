import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { AnioAcademico } from '../anios-academicos/anio-academico.entity';
import { Grado } from '../grados/grado.entity';
import { Usuario } from '../../usuarios/usuario.entity';

@Entity({ schema: 'public', name: 'secciones' })
export class Seccion {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'anio_academico_id', type: 'smallint' })
  anioAcademicoId: number;

  @ManyToOne(() => AnioAcademico)
  @JoinColumn({ name: 'anio_academico_id' })
  anioAcademico: AnioAcademico;

  @Column({ name: 'grado_id', type: 'smallint' })
  gradoId: number;

  @ManyToOne(() => Grado)
  @JoinColumn({ name: 'grado_id' })
  grado: Grado;

  @Column({ type: 'varchar', length: 10 })
  nombre: string;

  @Column({ name: 'tutor_id', type: 'uuid', nullable: true })
  tutorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'tutor_id' })
  tutor: Usuario | null;

  @Column({ name: 'hora_ingreso', type: 'time', default: '08:00' })
  horaIngreso: string;

  @Column({ name: 'tolerancia_min', type: 'smallint', default: 10 })
  toleranciaMin: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}