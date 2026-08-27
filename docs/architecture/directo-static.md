# ADR-001: aislar el modo dual como página estática

**Estado:** aceptada y desplegada en QA y producción
**Fecha:** 23 de agosto de 2026  
**Decisor:** propietario del proyecto

## Contexto

El punto de entrada más concurrido durante un directo es el modo dual VK + Twitch. Hasta ahora se abre mediante `/inicio?stream=dual`, después de cargar el Server Component dinámico de Inicio, sesión/acceso público, permisos, directos recientes, el shell completo, notificaciones y varios estados React. Aunque el contenido visible sea el teatro, cada entrada atraviesa Node y parte de PostgreSQL.

El incidente del 21 de agosto demostró que cientos de entradas legítimas y concentradas pueden amplificar cualquier trabajo innecesario del camino público. La carga de video y chat ya se entrega desde VK y Twitch; el servidor propio solo necesita entregar el contenedor.

La app móvil Lolweapon+ fue auditada por separado. No consume `/inicio?stream=dual`: implementa VK, Twitch y chat en tres WebViews nativos y consulta únicamente la API pública de estado Twitch. Crear `/directo` no cambia su contrato ni requiere un release móvil.

## Decisión

Servir `/directo` como un único archivo HTML/CSS/JavaScript estático directamente desde Nginx. La página contiene solamente:

- iframe principal de VK;
- iframe companion de Twitch, inicialmente silenciado para autoplay;
- iframe del chat oficial de Twitch;
- controles para intercambiar y dimensionar los players, mostrar el chat, abrir una vista completa compuesta, recargar, consultar ayuda/información y salir;
- layout responsive y compatibilidad opcional con `?layout=android`.

En móvil vertical los players se apilan y se intercambian sin desmontar los iframes. El chat permanece montado, oculto inicialmente, y al abrirse cubre siempre el segundo player mientras la distribución cambia a 30 % para el player principal y 70 % para el chat. En tablet vertical se usa una proporción más equilibrada de 58/42 sin chat y 42/58 con chat. En orientación horizontal ambos players ocupan una única fila en mitades iguales; al mostrar el chat, este cubre solamente el área del player secundario, que permanece montado debajo. Así se evita el espacio vacío causado por combinar una cuadrícula horizontal con las filas 30/70 del modo vertical. La información se mantiene en un modal móvil.

En tablets horizontales de mayor tamaño se conserva la misma interacción: player principal a la izquierda y una columna secundaria de al menos 400 px. Ambos players son visibles inicialmente y el botón de chat cubre únicamente la columna secundaria; el iframe del player cubierto permanece montado. La ficha del canal se oculta en ese rango para priorizar altura útil. En desktop existen una posición principal y otra secundaria: intercambiar mueve Twitch a la posición de VK y VK a la de Twitch, mientras el chat conserva su columna propia y permanece visible. No existe modal de información en desktop: la ficha pública completa y sus acciones quedan bajo el player principal. El ancho de la columna secundaria puede ajustarse sin bajar Twitch de 400 px.

El icono de intercambio representa la geometría activa: flechas verticales cuando los players están apilados y horizontales cuando ocupan columnas. En navegadores móviles se solicita `interactive-widget=resizes-content` y se mantiene `--app-height` sincronizado con `visualViewport.height`. Al aparecer el teclado, la página y el iframe fijo del chat se recalculan dentro del área visible sin desmontar, cubrir ni interceptar el chat oficial; al cerrarlo recuperan la altura disponible. El resultado exacto continúa sujeto al soporte del teclado y viewport de cada navegador, especialmente Safari.

Chrome Android puede solicitar “Sitio para ordenadores” para mejorar la compatibilidad con VK y reportar un viewport cercano a 980 px. La página detecta automáticamente teléfonos mediante puntero grueso, soporte táctil y lado físico corto de hasta 600 px; en ese caso activa internamente el layout móvil escalado sin exigir `?layout=android`. El parámetro se conserva como fallback manual. La escala usa el ancho físico vertical u horizontal correspondiente para no sobredimensionar la cabecera al rotar. Como el `transform` móvil convierte al body en referencia de los elementos fijos, la geometría del iframe del chat se divide por esa escala antes de posicionarlo; esto evita aplicar el factor dos veces y desplazar el chat fuera de pantalla. La detección se recalcula al rotar, redimensionar, entrar en fullscreen o cambiar el viewport visual. El iframe fijo del chat permanece oculto por defecto también bajo este layout y solo se habilita junto con el estado visual del botón. El fullscreen móvil usa players apilados en vertical y dos columnas en horizontal; el chat continúa cubriendo solo el player secundario. En orientación horizontal, el iframe del chat usa una superficie interna al 125% reducida visualmente al 80%, lo que muestra más contenido sin intentar modificar el documento cross-origin de Twitch ni alterar las vistas vertical y de escritorio.

En teléfonos horizontales, la cabecera global se elimina y sus acciones se trasladan a la cabecera del player principal. La distribución reserva 70% del ancho al player principal y 30% al player secundario o al chat. Al mostrar el chat también se oculta su cabecera externa redundante, de modo que el iframe oficial ocupa toda la altura de la columna derecha. Al intercambiar los players, la barra de acciones acompaña al nuevo principal y la proporción 70/30 se conserva; al volver a vertical se restaura automáticamente en la cabecera global sin remontar los reproductores.

La vista completa propia solicita fullscreen para el documento y no para un iframe cross-origin. Distribuye aproximadamente 75 % al player principal y 25 % a una columna con el player secundario arriba y el chat abajo, sin remontar ninguno de los tres embeds. Una fila de controles independiente evita superponer elementos al player o al chat de Twitch y permite intercambiar ambos reproductores sin salir del fullscreen. El fullscreen nativo de VK o Twitch continúa mostrando exclusivamente ese proveedor.

La página no resuelve sesión o permisos, no consulta PostgreSQL, no abre WebSockets propios y no hace llamadas dinámicas a Next.js. Nginx entrega el archivo antes del proxy hacia Next.js. La metadata pública de Twitch se publica cada 30 segundos como `/directo-status.json`: `server.mjs` actualiza atómicamente una única copia usando la misma caché compartida de `/api/twitch/status`, y cada navegador solo descarga ese JSON estático cacheable. Si Node, Twitch o el snapshot fallan, los embeds siguen funcionando y el modal degrada a `Sin datos`.

Nginx no lee el archivo desde `/home/kalaplex`: ese home no es atravesable por `www-data` y abrirlo ampliaría permisos innecesariamente. QA publica una copia en `/var/www/resubidos-qa/directo.html` y producción en `/var/www/resubidos/directo.html`; ambos directorios pertenecen al usuario de deploy y al grupo `www-data`. El workflow actualiza la copia correspondiente con `install -m 0644` después de completar build y migraciones.

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
- La página no muestra presencia, notificaciones ni información personalizada. Solo muestra un snapshot estático y prescindible de metadata pública de Twitch.
- `/api/twitch/status` se conserva porque la app móvil lo consume y ya dispone de caché breve.
- Twitch inicia silenciado para facilitar autoplay y solicita `play()` al montar, al recibir `PAUSE`/`PLAYBACK_BLOCKED`/`ONLINE` y al recuperar foco o visibilidad. Cada recuperación realiza un intento inmediato y tres reintentos limitados, a 300 ms, 1 segundo y 2,5 segundos; se cancelan al confirmar reproducción u offline. Si después de 3,2 segundos el navegador sigue exigiendo un gesto, muestra la acción manual `Activar Twitch`. Después de inicializar no vuelve a imponer `setMuted(true)`: si el usuario activa el sonido, los intentos automáticos de reanudar respetan esa decisión. Las restricciones del navegador o del proveedor no se pueden eludir ni garantizan que una view sea contabilizada.
- El chat no se superpone al player en desktop. En la vista completa compuesta ocupa una columna propia junto al player secundario; Twitch conserva geometría protegida cuando está visible.
- En desktop el iframe del chat se renderiza sin un ancestro que lo recorte con `overflow`, borde o radio. La cabecera ocupa su propia fila y no se superpone al iframe, evitando que Twitch deshabilite herramientas de moderación por detectar una obstrucción.
- El iframe oficial del chat conserva la sesión Twitch que el navegador permita compartir; puede pedir login cuando cookies o almacenamiento de terceros estén bloqueados.
- La implementación nativa móvil no debe reemplazarse por `/directo`; hacerlo perdería contratos nativos como PiP y sería otro proyecto.

## Verificación requerida

1. Confirmar que `/directo` es atendido por Nginx y no contiene headers de upstream Next.
2. Confirmar cero solicitudes a `/api/*`, `/api/notifications/ws` y `/api/presence/ws`; `/directo-status.json` debe ser servido por Nginx.
3. Probar VK, Twitch y chat en desktop, tablet, Android e iOS.
4. Probar chat expandido, recarga, salida, fullscreen y `?layout=android`.
5. Comprobar que las acciones de moderación del chat no queden bloqueadas por superposiciones.
6. Medir 500–800 solicitudes concurrentes al HTML estático.
7. Validar que la página siga respondiendo con `resubidos-qa.service` detenido durante una prueba controlada en QA.

## Configuración del snapshot

Cada ambiente define el directorio publicado, sin incluir el nombre del archivo:

```dotenv
# QA
DIRECTO_STATIC_DIR=/var/www/resubidos-qa

# Producción
DIRECTO_STATIC_DIR=/var/www/resubidos
```

Nginx debe servir el JSON antes del proxy, con caché breve:

```nginx
location = /directo-status.json {
    alias /var/www/resubidos-qa/directo-status.json;
    default_type application/json;
    etag on;
    expires 15s;
}
```

En producción se reemplaza únicamente la ruta del `alias`. El archivo no contiene tokens, IDs internos, sesión ni datos de usuarios.

## Caché de Cloudflare

Cloudflare no incluye HTML ni JSON entre sus extensiones cacheables por defecto. Crear una Cache Rule limitada exclusivamente al hostname del ambiente y a `/directo`/`/directo-status.json`, con `Cache eligibility: Eligible for cache`.

No forzar `Edge TTL`: debe respetar los headers del origen. Nginx entrega `/directo` con `max-age=300` y `/directo-status.json` con `max-age=15`, conservando el equilibrio entre absorción de picos y actualidad. Mantener también Browser TTL en `Respect existing headers` y la cache key predeterminada.

Nunca ampliar esta regla a `/inicio`, `/api/*`, autenticación ni otras rutas dinámicas. Después de desplegar HTML nuevo, purgar únicamente la URL exacta de `/directo`; no usar `Purge Everything`.

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
