import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomInt, scryptSync } from 'crypto';
import { ILike, Repository } from 'typeorm';
import { handleDbError } from '../common/db.errors';
import { Alumno } from './alumno.entity';
import { CreateAlumnoDto } from './dto/create-alumno.dto';
import { ImportarAlumnoDto } from './dto/importar-alumnos.dto';
import { UpdateAlumnoDto } from './dto/update-alumno.dto';

const MSG_UNICO = 'Ya existe un alumno con ese código o DNI';
function createFamilyAccessCode() {
  return randomInt(0, 10_000).toString().padStart(4, '0')
}

function hashFamilyAccessCode(code: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(code, salt, 64)
  return `${salt.toString('base64url')}:${hash.toString('base64url')}`
}

@Injectable()
export class AlumnoService {
  constructor(@InjectRepository(Alumno) private readonly repo: Repository<Alumno>) {}

  async importar(dtos: ImportarAlumnoDto[]) {
    const nombresSeparados = dtos.map(({ alumno }) => {
      const partes = alumno.trim().split(/\s+/);
      if (partes.length < 2) {
        throw new BadRequestException('Cada alumno debe incluir al menos nombres y un apellido');
      }
      return {
        nombres: partes.slice(0, -1).join(' '),
        apellidos: partes[partes.length - 1],
      };
    });
    const dni = dtos.map((alumno) => alumno.dni.trim());
    if (new Set(dni).size !== dni.length) {
      throw new ConflictException('El archivo contiene DNI repetidos');
    }

    try {
      return await this.repo.manager.transaction(async (manager) => {
        const alumnos = dtos.map((dto, index) => {
          const codigoAccesoFamilia = createFamilyAccessCode();
          return {
            alumno: manager.getRepository(Alumno).create({
              dni: dto.dni.trim(),
              ...nombresSeparados[index],
              fechaNacimiento: dto.fechaNacimiento,
              activo: true,
              codigo: `AL${randomBytes(4).toString('hex').toUpperCase()}`,
              codigoAccesoFamiliaHash: hashFamilyAccessCode(codigoAccesoFamilia),
            }),
            codigoAccesoFamilia,
          };
        });
        const guardados = await manager.getRepository(Alumno).save(alumnos.map(({ alumno }) => alumno));
        return guardados.map((alumno, index) => {
          const { codigoAccesoFamiliaHash: _hash, ...registro } = alumno;
          return { ...registro, codigoAccesoFamilia: alumnos[index].codigoAccesoFamilia };
        });
      });
    } catch (e) {
      handleDbError(e, { unique: MSG_UNICO });
    }
  }

  async create(dto: CreateAlumnoDto) {
    const codigo =
      dto.codigo?.trim().toUpperCase() ?? `AL${randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      const codigoAccesoFamilia = createFamilyAccessCode()
      const alumno = await this.repo.save(this.repo.create({
        ...dto,
        codigo,
        codigoAccesoFamiliaHash: hashFamilyAccessCode(codigoAccesoFamilia),
      }))
      const {
        codigoAccesoFamiliaHash: _hash,
        ...alumnoSinHash
      } = alumno
      return { ...alumnoSinHash, codigoAccesoFamilia }
    } catch (e) {
      handleDbError(e, { unique: MSG_UNICO });
    }
  }

  // Búsqueda por nombre, apellido, DNI o código, con paginación
  async findAll(q?: string, page = 1, limit = 20, activosOnly = false) {
    limit = Math.min(Math.max(limit, 1), 100);
    page = Math.max(page, 1);
    const like = q?.trim() ? `%${q.trim()}%` : null;

    const activoFilter = activosOnly ? { activo: true } : {};
    const [data, total] = await this.repo.findAndCount({
      where: like
        ? [
            { ...activoFilter, apellidos: ILike(like) },
            { ...activoFilter, nombres: ILike(like) },
            { ...activoFilter, dni: ILike(like) },
            { ...activoFilter, codigo: ILike(like) },
          ]
        : activoFilter,
      order: { apellidos: 'ASC', nombres: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const alumno = await this.repo.findOne({ where: { id } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    return alumno;
  }

  async generarCodigoAccesoFamilia(id: string) {
    const alumno = await this.findOne(id)
    if (!alumno.dni) {
      throw new NotFoundException('Registra primero el DNI del alumno para generar su acceso familiar')
    }
    if (!alumno.activo) {
      throw new NotFoundException('No se puede generar acceso para un alumno inactivo')
    }
    const codigoAccesoFamilia = createFamilyAccessCode()
    alumno.codigoAccesoFamiliaHash = hashFamilyAccessCode(codigoAccesoFamilia)
    await this.repo.save(alumno)
    return {
      alumno: { id: alumno.id, nombres: alumno.nombres, apellidos: alumno.apellidos, dni: alumno.dni },
      codigoAccesoFamilia,
    }
  }

  // Lo usará el escaneo del QR / código de barras
  async findByCodigo(codigo: string) {
    const alumno = await this.repo.findOne({ where: { codigo: codigo.trim().toUpperCase() } });
    if (!alumno) throw new NotFoundException('Código de alumno no encontrado');
    return alumno;
  }

  async update(id: string, dto: UpdateAlumnoDto) {
    const alumno = await this.findOne(id);
    Object.assign(alumno, dto);
    if (dto.codigo) alumno.codigo = dto.codigo.trim().toUpperCase();
    try {
      return await this.repo.save(alumno);
    } catch (e) {
      handleDbError(e, { unique: MSG_UNICO });
    }
  }

  // No se borra (hay matrículas y asistencias): se desactiva
  async desactivar(id: string) {
    const alumno = await this.findOne(id);
    alumno.activo = false;
    return this.repo.save(alumno);
  }
}