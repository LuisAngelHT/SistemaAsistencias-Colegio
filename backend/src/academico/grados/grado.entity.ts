import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum NivelEducativo {
  INICIAL = 'inicial',
  PRIMARIA = 'primaria',
  SECUNDARIA = 'secundaria',
}

@Entity({ schema: 'public', name: 'grados' })
export class Grado {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'enum', enum: NivelEducativo, enumName: 'nivel_educativo' })
  nivel: NivelEducativo;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'smallint' })
  orden: number;
}