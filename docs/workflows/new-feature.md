# Workflow: Nueva Feature

Checklist para agregar una feature que involucra datos, UI, permisos, rutas o documentación.

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
