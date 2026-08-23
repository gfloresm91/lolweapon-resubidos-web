# ADR-001: aislar el modo dual como página estática

**Estado:** aceptada y certificada en QA; pendiente producción
**Fecha:** 23 de agosto de 2026  
**Decisor:** propietario del proyecto

## Contexto

El punto de entrada más concurrido durante un directo es el modo dual VK + Twitch. Hasta ahora se abre mediante `/inicio?stream=dual`, después de cargar el Server Component dinámico de Inicio, sesión/acceso público, permisos, directos recientes, el shell completo, notificaciones y varios estados React. Aunque el contenido visible sea el teatro, cada entrada atraviesa Node y parte de PostgreSQL.

El incidente del 21 de agosto demostró que cientos de entradas legítimas y concentradas pueden amplificar cualquier trabajo innecesario del camino público. La carga de video y chat ya se entrega desde VK y Twitch; el servidor propio solo necesita entregar el contenedor.

La app móvil Lolweapon+ fue auditada por separado. No consume `/inicio?stream=dual`: implementa VK, Twitch y chat en tres WebViews nativos y consulta únicamente la API pública de estado Twitch. Crear `/directo` no cambia su contrato ni requiere un release móvil.

## Decisión

Servir `/directo` como un único archivo HTML/CSS/JavaScript estático directamente desde Nginx. La página contiene solamente:

- iframe principal de VK;
- iframe companion de Twitch, silenciado;
- iframe del chat oficial de Twitch;
- controles mínimos para chat, recarga y salida;
- layout responsive y compatibilidad opcional con `?layout=android`.

La página no resuelve sesión o permisos, no consulta PostgreSQL, no llama APIs internas y no abre WebSockets propios. Nginx entrega el archivo antes del proxy hacia Next.js. Cloudflare podrá cachear el HTML en una etapa posterior.

Nginx no lee el archivo desde `/home/kalaplex`: ese home no es atravesable por `www-data` y abrirlo ampliaría permisos innecesariamente. QA publica una copia en `/var/www/resubidos-qa/directo.html`, directorio propiedad del usuario de deploy y grupo `www-data`; el workflow actualiza esa copia con `install -m 0644` después de completar build y migraciones. Producción debe usar el equivalente `/var/www/resubidos/directo.html` cuando se apruebe el release.

Se conserva un fallback estático de Next: mientras Nginx no tenga la ubicación exacta, `/directo` redirige a `/directo/index.html`. Los enlaces web nuevos abren `/directo`. Los enlaces antiguos con `/inicio?stream=dual` también navegan allí al montar y posteriormente podrán redirigirse en Nginx antes de tocar Node.

## Opciones consideradas

### Mantener el teatro dentro de Inicio

| Dimensión | Evaluación |
| --- | --- |
| Complejidad | Baja |
| Aislamiento | Bajo |
| Capacidad ante picos | Depende de Node y PostgreSQL |

Ventaja: no requiere cambios. Desventaja: mantiene el punto caliente acoplado a toda la plataforma.

### Página Next.js independiente

| Dimensión | Evaluación |
| --- | --- |
| Complejidad | Media |
| Aislamiento | Medio |
| Capacidad ante picos | Mejor, pero comparte runtime/layout |

Ventaja: reutiliza componentes. Desventaja: el root layout monta el reproductor persistente y la entrega inicial todavía depende de Node.

### Archivo estático servido por Nginx

| Dimensión | Evaluación |
| --- | --- |
| Complejidad | Media |
| Aislamiento | Alto |
| Capacidad ante picos | Alta; contenido idéntico y cacheable |

Ventaja: evita Node, PostgreSQL y bundles de la plataforma; continúa disponible aunque el proceso web se degrade. Desventaja: algunos estilos/comportamientos del teatro deben mantenerse independientemente.

## Consecuencias

- El HTML inicial pasa de cargar el shell con aproximadamente 423 kB de JavaScript inicial a un archivo autónomo de alrededor de 15 kB, más los recursos externos de los proveedores.
- El ancho de banda de video/chat continúa siendo responsabilidad de VK y Twitch.
- Cambios visuales del teatro deben aplicarse explícitamente a la página estática cuando corresponda.
- El canal Twitch se selecciona por hostname: QA usa su canal de prueba y producción el canal público actual.
- La página no muestra presencia, notificaciones ni metadata dinámica del stream para mantener el aislamiento.
- `/api/twitch/status` se conserva porque la app móvil lo consume y ya dispone de caché breve.
- La implementación nativa móvil no debe reemplazarse por `/directo`; hacerlo perdería contratos nativos como PiP y sería otro proyecto.

## Verificación requerida

1. Confirmar que `/directo` es atendido por Nginx y no contiene headers de upstream Next.
2. Confirmar cero solicitudes a `/api/*`, `/api/notifications/ws` y `/api/presence/ws`.
3. Probar VK, Twitch y chat en desktop, tablet, Android e iOS.
4. Probar chat expandido, recarga, salida, fullscreen y `?layout=android`.
5. Comprobar que las acciones de moderación del chat no queden bloqueadas por superposiciones.
6. Medir 500–800 solicitudes concurrentes al HTML estático.
7. Validar que la página siga respondiendo con `resubidos-qa.service` detenido durante una prueba controlada en QA.

## Resultado en QA

Certificación completada el 23 de agosto de 2026:

- Con `resubidos-qa.service` detenido, `/directo` respondió `HTTP 200` directamente desde Nginx y `/inicio` respondió `502`, confirmando el aislamiento de Node.
- El servicio QA se restauró correctamente y quedó `active` junto con Nginx.
- Cinco oleadas de 100 conexiones nuevas: 500/500 respuestas `200`, cero errores, p95 172 ms.
- Cinco oleadas de 500 conexiones nuevas: 2.500/2.500 respuestas `200`, cero errores, p95 686 ms.
- Cinco oleadas de 800 conexiones nuevas: 4.000/4.000 respuestas `200`, cero errores, p50 1,20 s, p95 1,56 s, p99 1,64 s y máximo 1,68 s.
- La prueba creó conexiones TLS independientes directamente contra Nginx; es más costosa para el origen que la reutilización normal detrás de Cloudflare.
- Después de la carga: load average 0,41/0,34/0,18, aproximadamente 6,3 GiB de memoria disponible, 28 MiB de swap en uso sin crecimiento observado y cero errores recientes de Nginx.
- La comprobación posterior del origen respondió `200` en aproximadamente 6 ms.

Esta certificación cubre la entrega del HTML estático, no la capacidad de VK/Twitch ni el resto de la plataforma dinámica. Los iframes descargan su contenido directamente desde los proveedores.

## Rollback

1. Retirar las ubicaciones exactas de `/directo` de Nginx y recargarlo después de `nginx -t`.
2. Revertir mediante un commit nuevo el cambio de `requestDualMode()` para volver al teatro interno.
3. Mantener intacta la app móvil; no participa en este rollback.
