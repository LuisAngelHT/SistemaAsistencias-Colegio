// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from './supabase/supabase.module';
import { UsuarioModule } from './usuarios/usuario.module';
import { AuthModule } from './auth/auth.module';
import { AcademicoModule } from './academico/academico.module';
import { AlumnoModule } from './alumnos/alumno.module';
import { PortalFamiliarModule } from './apoderados/portal-familiar.module';
import { MatriculaModule } from './matriculas/matricula.module';
import { HorarioModule } from './horarios/horario.module';
import { AsistenciaModule } from './asistencia/asistencia.module';
import { ReportesModule } from './reportes/reportes.module';

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
    SupabaseModule, UsuarioModule, AuthModule, AcademicoModule, AlumnoModule, PortalFamiliarModule, MatriculaModule, HorarioModule, AsistenciaModule, ReportesModule
  ],
})
export class AppModule {}