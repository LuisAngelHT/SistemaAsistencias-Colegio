import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Matricula } from '../matriculas/matricula.entity';

export enum EstadoSolicitudJustificacion {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

export type TipoSolicitudJustificacion = 'falta_justificada' | 'tardanza_justificada';

@Entity({ schema: 'public', name: 'solicitudes_justificacion' })
export class SolicitudJustificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'matricula_id', type: 'uuid' })
  matriculaId: string;

  @ManyToOne(() => Matricula)
  @JoinColumn({ name: 'matricula_id' })
  matricula: Matricula;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoSolicitudJustificacion;

  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'varchar', length: 20, default: EstadoSolicitudJustificacion.PENDIENTE })
  estado: EstadoSolicitudJustificacion;

  @Column({ name: 'revisado_por', type: 'uuid', nullable: true })
  revisadoPor: string | null;

  @Column({ name: 'observacion_revision', type: 'text', nullable: true })
  observacionRevision: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
