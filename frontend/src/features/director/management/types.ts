export type ManagementModule =
  | 'profesores'
  | 'auxiliares'
  | 'alumnos'
  | 'secciones'
  | 'grados'
  | 'horarios'
  | 'cursos'
  | 'anios-academicos'
  | 'matriculas'

export type ApiRecord = Record<string, unknown>

export type ListResult = {
  data: ApiRecord[]
  total: number
  page: number
  limit: number
}

export type ManagementOptions = {
  years: ApiRecord[]
  grades: ApiRecord[]
  teachers: ApiRecord[]
  sections: ApiRecord[]
  courses: ApiRecord[]
}

export type FormValue = string | boolean
export type FormValues = Record<string, FormValue>

export type SelectOption = {
  value: string
  label: string
}

export type FieldDefinition = {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'date' | 'number' | 'time' | 'url' | 'select'
  required?: boolean
  min?: number
  max?: number
  maxLength?: number
  pattern?: string
  placeholder?: string
  options?: SelectOption[]
  help?: string
}
