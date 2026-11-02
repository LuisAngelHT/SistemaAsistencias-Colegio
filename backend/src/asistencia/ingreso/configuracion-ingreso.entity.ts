import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'public', name: 'configuracion_ingreso' })
export class ConfiguracionIngreso {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ name: 'hora_ingreso', type: 'time', default: '08:00' })
  horaIngreso: string;

  @Column({ name: 'tolerancia_min', type: 'smallint', default: 10 })
  toleranciaMin: number;

  @Column({ name: 'hora_limite', type: 'time', default: '10:10' })
  horaLimite: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
