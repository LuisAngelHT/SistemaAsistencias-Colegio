// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from './supabase/supabase.module';
import { UsuarioModule } from './usuarios/usuario.module';
import { AuthModule } from './auth/auth.module';
import { AcademicoModule } from './academico/academico.module';
import { AlumnoModule } from './alumnos/alumno.module';
import { ApoderadoModule } from './apoderados/apoderado.module';
import { MatriculaModule } from './matriculas/matricula.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: false, // el esquema ya lo creaste con tu script SQL
      }),
    }),
    SupabaseModule, UsuarioModule, AuthModule, AcademicoModule, AlumnoModule, ApoderadoModule, MatriculaModule
  ],
})
export class AppModule {}