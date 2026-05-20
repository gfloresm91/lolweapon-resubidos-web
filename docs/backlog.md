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

_(agregar aquí ideas sin prioridad definida)_
