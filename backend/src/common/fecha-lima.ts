const TZ = 'America/Lima';
const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function enLima(d: Date = new Date()) {
  return {
    fecha: d.toLocaleDateString('en-CA', { timeZone: TZ }), // YYYY-MM-DD
    hora: d.toLocaleTimeString('en-GB', { timeZone: TZ, hourCycle: 'h23' }), // HH:mm:ss
    diaSemana: DIAS[new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)],
  };
}

export function aSegundos(hhmmss: string): number {
  const [h, m, s = 0] = hhmmss.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}