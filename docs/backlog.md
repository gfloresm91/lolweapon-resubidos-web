# Backlog

Tareas pendientes, ideas y mejoras diferidas. Actualizar con cada sesión relevante.

## En progreso / Próximo

_(vacío)_

## Pendiente

### Player Twitch — transición full→mini

- **Problema:** Al navegar de `/inicio` al mini player, el reproductor se pausa brevemente.
- **Causa conocida:** El efecto `schedulePlaybackResume` tiene `routeMode` como dependencia, lo que causa una doble llamada a `play()` durante la transición.
- **Estado:** Diferido por el usuario (2026-05-19). El resto de mejoras (keep-alive, CSS scale transition, `isPlayerOnline`) ya están aplicadas.
- **Archivo:** `components/PersistentTwitchPlayer.js`

### Merge dev → main (v2.0.0 a producción)

- Los cambios de v2.0.0 están en `dev` (QA). Pendiente validar y hacer el merge a `main`.
- Ver `/release` para el checklist completo.

## Ideas / Mejoras futuras

### Doble polling de Twitch status

- `HomeDashboard` y `PersistentTwitchPlayer` hacen fetch a `/api/twitch/status` de forma independiente cada 60 segundos.
- Impacto: doble carga innecesaria al servidor de Twitch.
- Approach sugerido: compartir el estado via React Context o subir el fetch al Server Component y pasarlo como prop inicial, dejando solo un poller activo.

### Refactor de HomePage.js

- `components/HomePage.js` tiene ~1500 líneas y maneja 10+ vistas distintas (home, tracker, mi lista, anime, admin, spacedrum), todo el estado global, filtros, permisos y fetches.
- Impacto: difícil de mantener, todo el código se carga para todos los usuarios.
- Approach sugerido: separar cada vista en su propio componente contenedor con su estado local, y dejar `HomePage.js` solo como shell de navegación.
