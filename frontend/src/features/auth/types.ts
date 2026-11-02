export type Usuario = {
  id?: string
  apoderadoId?: string
  nombres: string
  apellidos: string
  email: string
  rol: 'director' | 'auxiliar' | 'profesor' | 'apoderado'
}
