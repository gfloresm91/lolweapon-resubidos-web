# Workflow: Nueva Feature

Checklist para agregar una feature que involucra datos, UI, permisos, rutas o documentación.

## 0. Análisis Previo

Usar cuando el usuario pida plan antes de código o cuando la feature tenga decisiones de arquitectura, permisos, datos o UI responsiva.

1. Confirmar el objetivo funcional en una frase.
2. Ubicar dónde vive la feature:
   - ruta directa;
   - navegación interna en `HomePage`;
   - menú o grupo del sidebar;
   - permiso requerido.
3. Revisar los datos existentes antes de proponer schema nuevo.
4. Definir si requiere:
   - schema Prisma o migración;
   - soporte JSON/Postgres;
   - repositorio nuevo o extensión de uno existente;
   - API route;
   - permiso nuevo;
   - auditoría `AuditLog`;
   - documentación;
   - pruebas visuales.
5. Para features con acceso restringido:
   - nombrar el permiso;
   - definir roles con asignación por defecto;
   - decidir si `Dios` entra por regla general o si será una exclusión explícita.
6. Para UI nueva:
   - proponer comportamiento desktop/mobile antes de editar;
   - definir vistas principales y estados vacíos;
   - definir interacciones a validar con Playwright.
7. Cerrar el plan con archivos probables, comandos de verificación y pendientes de decisión.
8. Definir la rama de trabajo antes de implementar:
   - proponer nombre descriptivo, por ejemplo `feature/tracker-calendar`;
   - confirmar rama base esperada, normalmente `dev`;
   - entregar el comando `git checkout -b <rama>` para que el usuario lo ejecute, salvo que pida explícitamente que el agente cree la rama.

### Resoluciones Para Pruebas Visuales

Para cambios visuales relevantes, validar con screenshots reales en estas resoluciones:

| Tipo | Resolución | Uso |
|---|---:|---|
| Mobile mínimo | `320 x 1080` | Ancho crítico, textos y controles apilados |
| Mobile angosto | `360 x 740` | Alto reducido y scroll |
| Mobile base | `390 x 844` | Teléfono moderno estándar |
| Mobile grande | `430 x 932` | iPhone grande |
| Tablet vertical | `768 x 1080` | Layout intermedio alto |
| Tablet estándar | `768 x 1024` | Tablet vertical común |
| Breakpoint sidebar | `900 x 900` | Cambio de comportamiento del menú lateral |
| Laptop | `1024 x 1080` | Sidebar visible en ancho contenido |
| Desktop estándar | `1280 x 900` | Layout desktop base |
| Desktop amplio | `1440 x 1080` | Layout amplio |

Con Playwright, probar acceso directo por URL, navegación interna desde otra vista, estados interactivos relevantes y screenshots antes de entregar. Si Playwright no puede cubrir un estado por permisos o datos locales, documentar el bloqueo y validar lo demás.

## 1. Contexto

1. Leer `AGENTS.md`.
2. Revisar `docs/project-overview.md` para arquitectura y permisos actuales.
3. Revisar `docs/backlog.md` si la feature viene de una tarea diferida.
4. Buscar patrones existentes con `rg` antes de crear componentes nuevos.

## 2. Decisión De Alcance

Definir antes de editar:

- ¿Requiere schema Prisma?
- ¿Requiere soporte JSON y Postgres?
- ¿Requiere permisos nuevos?
- ¿Requiere ruta nueva?
- ¿Requiere cambios visuales homologados?
- ¿Requiere auditoría `AuditLog`?
- ¿Requiere actualizar `.env.example`?

Si hay trade-offs visuales o de arquitectura, explicar opciones y esperar confirmación.

## 3. Schema Y Migración

Si cambia `prisma/schema.prisma`:

```bash
npm run db:migrate
npm run db:generate
```

Reglas:

- Crear migración solo en local.
- Usar nombre descriptivo `YYYYMMDDHHMMSS_descripcion_corta`.
- En QA/producción usar solo:

```bash
npm run db:migrate:deploy
```

## 4. Repositorios

- Implementar en `lib/repositories/`.
- Mantener la abstracción `DATA_SOURCE=json` / `DATA_SOURCE=postgres` cuando la entidad ya la soporta.
- No hacer fetch directo desde componentes si existe repositorio para esa entidad.
- Sanitizar datos sensibles si se guardan logs o snapshots.

## 5. API Routes

- Crear/editar `app/api/<recurso>/route.js`.
- Validar input en el boundary.
- Verificar sesión/permisos con helpers de `lib/serverAuth`.
- Responder JSON estructurado:

```js
return NextResponse.json({ success: true, data });
```

Errores:

```js
return NextResponse.json(
  { success: false, error: "Mensaje claro" },
  { status: 400 },
);
```

## 6. Permisos

Si hay pantalla o acción nueva:

1. Agregar permiso en el repositorio/seed correspondiente.
2. Mostrarlo en el mantenedor de roles.
3. Probar que `Dios` tenga acceso total por defecto salvo exclusiones explícitas.
4. Respetar configuración por rol; no bloquear por nombre de rol salvo reglas de negocio explícitas.

Reglas especiales:

- `Dios` es inmutable.
- `anime.rating.streamer` no debe asignarse automáticamente a `Dios`.

## 7. UI

- Revisar `docs/design-system.md`.
- Reutilizar componentes existentes.
- Evitar nuevas clases si una clase estándar sirve.
- Para mantenedores usar:
  - `MaintainerStats`
  - `MaintainerToolbar`
  - `MaintainerTable`
  - `MaintainerModal`
  - `ConfirmModal`
- Si se crea o modifica un mantenedor, aplicar el estándar de tablas administrativas de `docs/design-system.md`:
  - datos atómicos por columna;
  - búsqueda compatible con columnas visibles;
  - jerarquía visual tranquila;
  - ordenamiento con indicador activo y dirección;
  - paginación con selector no nativo y opción `Todos`;
  - scroll horizontal propio en `.maintainer-table-scroll` cuando la tabla no quepa, sin overflow global;
  - pista `Desliza horizontalmente para ver más columnas` visible arriba de las tablas solo cuando tengan scroll horizontal real;
  - `--maintainer-table-min-width` global suficiente para columnas y acciones completas;
  - pruebas Playwright autenticadas en desktop y mobile.
- Para pruebas Playwright autenticadas, usar un usuario admin local de prueba y pasar credenciales por variables locales como `PLAYWRIGHT_ADMIN_LOGIN` y `PLAYWRIGHT_ADMIN_PASSWORD`; no versionar usuario/clave concretos.
- Para botones que requieren sesión: toast/modal con acción para login, no redirección brusca.

## 8. Auditoría

Si la feature modifica datos desde administración:

- Registrar en `AuditLog`.
- Usar módulo consistente (`admin.users`, `admin.roles`, etc.).
- Guardar `before`/`after` cuando sea útil.
- No registrar passwords, tokens ni secretos.
- La auditoría no debe romper la operación si falla.

## 9. Documentación

Actualizar según corresponda:

- `docs/project-overview.md`
- `docs/backlog.md`
- `docs/design-system.md`
- `.env.example`
- `README.md`
- `AGENTS.md` / `CLAUDE.md` si cambia una regla operativa.

## 10. Verificación

Para cambios de código:

```bash
npm run build
```

Para cambios solo de documentación, omitir build salvo petición explícita.

Si cambió Prisma:

```bash
npm run db:generate
npm run build
```

## 11. Si Se Difiere

Registrar en `docs/backlog.md`:

- Qué es.
- Decisiones tomadas.
- Archivos a crear/modificar.
- Paso exacto donde quedó.
- Motivo del diferimiento.
