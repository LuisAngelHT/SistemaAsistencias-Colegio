import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Matricula } from '../../matriculas/matricula.entity';
import { EstadoAsistencia, MetodoRegistro } from '../asistencia.enums';

@Entity({ schema: 'public', name: 'asistencia_ingreso' })
export class AsistenciaIngreso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'matricula_id', type: 'uuid' })
  matriculaId: string;

  @ManyToOne(() => Matricula)
  @JoinColumn({ name: 'matricula_id' })
  matricula: Matricula;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'hora_registro', type: 'timestamptz', nullable: true })
  horaRegistro: Date | null;

  @Column({ type: 'enum', enum: EstadoAsistencia, enumName: 'estado_asistencia' })
  estado: EstadoAsistencia;

  @Column({
    type: 'enum',
    enum: MetodoRegistro,
    enumName: 'metodo_registro',
    default: MetodoRegistro.MANUAL,
  })
  metodo: MetodoRegistro;

  @Column({ name: 'registrado_por', type: 'uuid', nullable: true })
  registradoPor: string | null;

  @Column({ name: 'es_offline', type: 'boolean', default: false })
  esOffline: boolean;

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
