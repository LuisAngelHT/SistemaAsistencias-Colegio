import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export enum RolUsuario {
  DIRECTOR = 'director',
  AUXILIAR = 'auxiliar',
  PROFESOR = 'profesor',
}

@Entity({ schema: 'public', name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auth_user_id', type: 'uuid', unique: true, nullable: true })
  authUserId: string | null;

  @Column({ type: 'enum', enum: RolUsuario, enumName: 'rol_usuario' })
  rol: RolUsuario;

  @Column({ type: 'text' })
  nombres: string;

  @Column({ type: 'text' })
  apellidos: string;

  @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
  dni: string | null;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}