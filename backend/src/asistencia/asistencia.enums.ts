export enum EstadoAsistencia {
  PRESENTE = 'presente',
  TARDANZA = 'tardanza',
  TARDANZA_JUSTIFICADA = 'tardanza_justificada',
  FALTA = 'falta',
  FALTA_JUSTIFICADA = 'falta_justificada',
  RETIRO_TEMPRANO = 'retiro_temprano',
  EVASION = 'evasion',
}

export enum MetodoRegistro {
  MANUAL = 'manual',
  QR_CAMARA = 'qr_camara',
  LECTOR_BARRAS = 'lector_barras',
  IMPORTACION = 'importacion',
}
