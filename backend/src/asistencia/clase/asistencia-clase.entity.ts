import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
  Unique, UpdateDateColumn,
} from 'typeorm';
import { Horario } from '../../horarios/horario.entity';
import { Matricula } from '../../matriculas/matricula.entity';
import { Usuario } from '../../usuarios/usuario.entity';
import { EstadoAsistencia } from '../asistencia.enums';

@Entity({ schema: 'public', name: 'asistencia_clase' })
@Unique('uq_asistencia_clase_horario_matricula_fecha', ['horarioId', 'matriculaId', 'fecha'])
export class AsistenciaClase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'horario_id', type: 'int' })
  horarioId: number;

  @ManyToOne(() => Horario)
  @JoinColumn({ name: 'horario_id' })
  horario: Horario;

  @Column({ name: 'matricula_id', type: 'uuid' })
  matriculaId: string;

  @ManyToOne(() => Matricula)
  @JoinColumn({ name: 'matricula_id' })
  matricula: Matricula;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'enum', enum: EstadoAsistencia, enumName: 'estado_asistencia' })
  estado: EstadoAsistencia;

  @Column({ name: 'registrado_por', type: 'uuid' })
  registradoPor: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
