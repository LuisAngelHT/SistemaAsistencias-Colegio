<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Asistencia por clase

Antes de usar el panel del profesor, ejecuta una vez el script
[`sql/asistencia-clase.sql`](./sql/asistencia-clase.sql) en PostgreSQL para crear la
tabla que guarda asistencias por horario y fecha. Esta tabla es independiente de
`asistencia_ingreso`, que conserva la asistencia de ingreso al colegio.

Después, reinicia el backend para habilitar `GET /asistencia/clase` y
`POST /asistencia/clase?horarioId=<id>`.

Para que las ausencias en clase se registren como evasión, ejecuta una vez
[`sql/evasion-asistencia-clase.sql`](./sql/evasion-asistencia-clase.sql) en Supabase.
Las faltas históricas de clase se muestran como evasión en los reportes; los nuevos
registros se guardan con ese estado. La asistencia al ingreso al colegio mantiene
sus estados independientes.

## Carga masiva y reportes de asistencia

En **Gestión escolar → Alumnos**, la dirección puede importar hasta 500 filas por
carga desde un archivo `.xlsx` o `.csv` compatible con Excel. Las columnas requeridas
son `Alumno`, `DNI` y `Fecha de nacimiento` (en formato `AAAA-MM-DD` o `DD/MM/AAAA`).
El código de alumno y el código de acceso familiar de cuatro dígitos se generan
automáticamente, y el registro queda activo. El QR se obtiene a partir del código
de alumno y se muestra en su ficha. La importación es atómica: si un registro no
pasa la validación o ya existe el DNI, no se crea ninguna fila. Descarga el archivo
de accesos que aparece al finalizar y entrégalo a cada familia.

El panel del director muestra una gráfica de líneas de los últimos 7 días con
asistencia de ingreso al colegio (presente, tardanza y falta), alertas de evasión
de clases y un CSV descargable que incluye exclusivamente registros de ingreso de
ese mismo periodo. El portal familiar incluye
los registros de ingreso y las asistencias por curso; puede descargarse el periodo
seleccionado como CSV. La API directiva requiere el rol director y expone
`GET /reportes/resumen-asistencia`, `GET /reportes/asistencia` y
`GET /reportes/evasiones-recientes`.

La configuración de ingreso del auxiliar también incluye una hora límite posterior
al fin de la tolerancia. Al alcanzar esa hora, el backend registra como falta a las
matrículas activas del año académico vigente que no tengan registro. Si el alumno
llega después, el QR o el auxiliar pueden registrar su tardanza y reemplazar la falta
automática. Para instalar o actualizar la tabla de configuración, ejecuta
`backend/sql/configuracion-horario-ingreso.sql` en Supabase.

## Cursos únicos por sección

Ejecuta una vez [`sql/curso-unico-por-seccion.sql`](./sql/curso-unico-por-seccion.sql)
en Supabase. El índice evita que un curso activo se asigne más de una vez a la
misma sección, incluso si dos solicitudes llegan simultáneamente. Si ya hay
duplicados activos, el script se detiene sin borrar ni modificar datos; primero
deberás resolverlos manualmente.

## Justificaciones y solicitudes familiares

La familia solicita justificar una falta o tardanza desde el portal. El auxiliar
recibe las solicitudes pendientes, las aprueba o rechaza y el sistema actualiza
`asistencia_ingreso` cuando aprueba. El director no tiene bandeja de solicitudes.
No se permite cargar documentos adjuntos.

## Horario general de ingreso

Ejecuta [`sql/configuracion-horario-ingreso.sql`](./sql/configuracion-horario-ingreso.sql)
una vez en Supabase al desplegar esta versión. La migración crea una hora general
de ingreso y una tolerancia para todo el colegio, toma los valores más usados entre
las secciones actuales y luego elimina esos campos de `secciones`.

El auxiliar puede cambiar la hora y tolerancia desde su panel para simulaciones.
El escaneo QR calcula presente o tardanza con la hora actual de Lima en el
backend. El reloj del panel muestra la hora de Lima en tiempo real.

## Portal familiar y solicitudes

Antes de habilitar el portal, ejecuta una vez
[`sql/portal-familiar.sql`](./sql/portal-familiar.sql) en el SQL Editor de Supabase.
El script agrega el código de acceso de los alumnos y crea o actualiza la tabla
de solicitudes.

El alumno necesita DNI y un código aleatorio de acceso familiar. Al crear un
alumno con DNI, el código se genera automáticamente y se muestra al director.
Para los alumnos existentes, usa el icono de ojo en **Acciones** para generar y
mostrar un código nuevo. El código tiene cuatro dígitos, se almacena como hash y
no se puede recuperar; al generar otro, el anterior deja de funcionar. Entrégalo
junto al DNI del alumno. En el login, pulsa **Soy apoderado** e ingresa ambos
datos. La sesión dura cuatro horas. Las cuentas familiares por correo y la gestión
de registros de apoderados ya no se utilizan.
El portal limita los intentos a cinco por DNI cada 15 minutos. El código de
cuatro dígitos es más fácil de adivinar que uno largo; el límite ayuda a reducir
ese riesgo.

El portal se vincula directamente con el alumno y sus matrículas; no necesita las
tablas `apoderados` ni `alumno_apoderados`. Ejecuta el SQL de migración antes de
usar la nueva versión para quitar esos vínculos antiguos y conservar las
solicitudes de justificación sin un campo de apoderado.

Para borrar todos los alumnos y sus datos asociados de asistencia, matrículas y
solicitudes antes de volver a cargarlos, ejecuta [`sql/reiniciar-alumnos.sql`](./sql/reiniciar-alumnos.sql)
después de la migración. Esta operación es irreversible; no borra grados,
secciones, cursos ni horarios.

La familia puede revisar asistencias y enviar solicitudes de falta o tardanza
justificada. Estas quedan pendientes en **Solicitudes familiares** del auxiliar;
el contador del botón muestra el total pendiente y se actualiza periódicamente.
Al aprobarlas se actualiza la asistencia; al rechazarlas, la familia puede
consultar el estado desde su portal. No se envían correos ni notificaciones push.
El DNI se combina siempre con el código secreto del colegio.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
