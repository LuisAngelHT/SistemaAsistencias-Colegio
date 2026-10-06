import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Apoderado } from './apoderado.entity';

export enum Parentesco {
  PADRE = 'padre',
  MADRE = 'madre',
  TUTOR = 'tutor',
  ABUELO = 'abuelo',
  OTRO = 'otro',
}

@Entity({ schema: 'public', name: 'alumno_apoderados' })
export class AlumnoApoderado {
  @PrimaryColumn({ name: 'alumno_id', type: 'uuid' })
  alumnoId: string;

  @PrimaryColumn({ name: 'apoderado_id', type: 'uuid' })
  apoderadoId: string;

  @ManyToOne(() => Apoderado)
  @JoinColumn({ name: 'apoderado_id' })
  apoderado: Apoderado;

  @Column({ type: 'enum', enum: Parentesco, enumName: 'parentesco' })
  parentesco: Parentesco;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @Column({ name: 'recibe_reportes', type: 'boolean', default: true })
  recibeReportes: boolean;
}