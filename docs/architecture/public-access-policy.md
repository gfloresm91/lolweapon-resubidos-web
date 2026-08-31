# Política de acceso público sin rol persistido

## Estado

Aceptada para implementación gradual el 29 de agosto de 2026.

Esta decisión forma parte de la Etapa 1.75 del [plan de resiliencia ante picos de tráfico](../operations/traffic-resilience-plan.md).

## Contexto

Una visita sin sesión se representa actualmente mediante el rol `invitado`. Resolver ese visitante ejecuta `getPublicAccessUser()`, que consulta `PlatformRole` y sus relaciones de permisos en PostgreSQL. Aunque existe una caché breve, la disponibilidad de páginas públicas continúa dependiendo de la base de datos y los validadores privados pueden aceptar el mismo fallback.

El incidente del 21 de agosto de 2026 demostró que el tráfico público no debe amplificar trabajo de autorización en PostgreSQL. Además, una página genuinamente pública no necesita que un administrador conceda o retire su acceso desde el mantenedor de roles.

## Decisión

Se elimina el rol persistido `invitado` y se separan dos conceptos:

1. **Acceso público:** una página o lectura se declara pública en su propio código. No consulta roles ni permisos para aceptar a un visitante.
2. **Autorización autenticada:** una acción protegida exige primero una sesión válida y luego evalúa los permisos configurados en PostgreSQL para ese usuario.

Los componentes reciben `currentUser: null` o una señal equivalente como `isAuthenticated: false`. No reciben un usuario de base de datos ficticio. Las decisiones visuales de iniciar sesión deben depender de autenticación, no del texto `role === "invitado"`.

## Inventario inicial

### Públicas por regla de código

| Superficie | Comportamiento público |
| --- | --- |
| `/directo` y `/directo-status.json` | Estáticos y sin sesión; no cambian. |
| Inicio | Lectura pública; las acciones personales continúan exigiendo sesión. |
| Rastreador y detalle de directos | Lectura pública; guardar actividad/progreso y administrar exige sesión y permisos. |
| Biblioteca Viendo y Terminados | Lectura pública; actividad, puntuaciones personales y administración exigen sesión y permisos. |
| `/novedades` | Lectura pública. |
| `/changelog` | Lectura pública. |
| `/rtfm` | Lectura pública. Su matriz informativa carga los roles y permisos configurados para explicar qué perfiles acceden a cada pantalla; esa lectura no participa en la autorización del visitante. |
| Tier List de animes, openings y endings | Consultar y ordenar localmente es público. Guardar, administrar o publicar cambios exige sesión y permiso. |
| Campana de notificaciones con `scope=public` | Solo publicaciones con audiencia pública; estado leído/descartado local. |
| Login, registro y callbacks públicos de autenticación | Públicos por definición de ruta. |

### Autenticadas con permisos configurables

| Superficie | Regla |
| --- | --- |
| Calendario histórico de directos | Sesión + `tracker.calendar.view`. |
| Mi lista | Sesión + permisos correspondientes. |
| Calendario de anime | Sesión + `anime.calendar.view`. |
| Spacedrum | Sesión + `spacedrum.view`. |
| Notificaciones completas y su gestión | Sesión + permiso correspondiente. |
| Administración, auditoría, uploads y mutaciones | Sesión obligatoria + permiso correspondiente. |

### Rutas mixtas que se deben separar dentro del handler

| Ruta | Lectura pública | Operación protegida |
| --- | --- | --- |
| `/api/anime-tier-list` | `GET` del tablero público. | `POST` de guardado exige sesión; acciones de administración exigen además el permiso de gestión. |
| `/api/notifications` | `GET?scope=public` devuelve solo audiencia pública. | Vista completa y `POST` exigen sesión/permisos. |
| `/api/navigation-map` | Puede entregar el mapa público de RTFM sin sesión. | Con sesión incorpora solo lo permitido al rol autenticado. |
| `/api/lives` y `/api/mobile/v1/lives` | Catálogo y detalle públicos. | Guardar, editar y notificar exigen sesión/bearer y permisos. |
| `/api/anime-library` | Catálogo público de Viendo y Terminados. | Actividad personal y mutaciones exigen sesión y permisos. |

Estas lecturas se mantienen públicas porque reproducen el comportamiento efectivo histórico del rol `invitado`; no se hicieron públicas por el solo hecho de usar `GET`.

## Implementación gradual

1. Separar helpers de sesión autenticada de cualquier contexto público.
2. Migrar primero las lecturas públicas explícitas y los handlers mixtos.
3. Hacer que todos los validadores privados respondan `401` sin sesión y `403` con sesión sin permiso.
4. Sustituir comparaciones visuales con `invitado` por estado de autenticación.
5. Retirar `invitado` de defaults, mantenedores y asignaciones automáticas.
6. Agregar una migración versionada que elimine relaciones y el rol solo cuando no queden dependencias de código.
7. Verificar como visitante, usuario común y administración, incluyendo navegación directa e interna.

## Consecuencias

### Positivas

- El tráfico sin sesión deja de consultar `PlatformRole` y `PlatformRolePermission`.
- Las páginas públicas no pueden cerrarse accidentalmente desde el mantenedor de roles.
- Los helpers privados dejan de mezclar autenticación y acceso público.
- La política queda auditable por ruta y mediante pruebas.

### Costos y riesgos

- Las rutas mixtas necesitan ramas explícitas y pruebas por método/acción.
- Algunos componentes usan hoy la cadena `invitado`; deben migrarse sin romper mensajes o guardado local.
- Eliminar el registro antes de migrar todos los consumidores produciría errores o pérdida de acceso, por lo que la migración de BD se ejecuta al final.
- Una allowlist global demasiado amplia sería peligrosa. La publicidad se declara cerca de cada página o handler, no mediante la regla “todo GET es público”.

## Verificación requerida

- Cero lecturas de roles/permisos para solicitudes sin cookie o bearer válido.
- Las superficies públicas inventariadas responden correctamente sin PostgreSQL disponible cuando sus datos propios no dependen de él.
- Las rutas privadas responden `401` sin sesión y `403` cuando el usuario autenticado carece del permiso.
- Guardar una Tier List, gestionar notificaciones y todas las mutaciones siguen exigiendo sesión.
- El rol `invitado` no aparece en administración ni existe en PostgreSQL al finalizar la etapa.
