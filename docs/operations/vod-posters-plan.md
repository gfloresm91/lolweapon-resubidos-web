# Plan de portadas y previsualizaciones para VOD

## Propósito y estado

Este documento permite implementar o continuar, incluso con otra IA, la generación de portadas y previsualizaciones visuales para los resubidos del Rastreador. Describe las decisiones ya acordadas, la estructura de archivos en Piero, el script reutilizable, la integración web, las verificaciones y el rollback.

Estado al 5 de septiembre de 2026 (cierre visual): **script, integración web y contrato visual aprobados; listo para commit y validación en QA; backfill masivo en Piero aún detenido; sin cambios en el downloader todavía.**

### Completado y verificado

**Infra (Etapa 0).** Piero tiene FFmpeg 4.4.2 con `libwebp`, ~24 TB libres. El servicio público (Caddy) monta `/archive/drive` como `/srv`, así que `/archive/drive/posters/` se sirve bajo `/posters/` sin nuevos mounts. `https://drive.kala-vods.com` es el host; los assets responden con MIME correcto (`image/webp`, `application/json`) y `Cache-Control: max-age=14400`; los 404 devuelven 404.

**Generador (`scripts/generate-vod-posters.py`, versionado en el repo e instalado en `/home/piero/tools/`).**
- CLI, mapeo seguro de rutas dentro de `--source-root`, selección de candidatos con `signalstats`, locks por vídeo con detección de obsoletos, temporales + rename atómico, `--dry-run`/`--missing-only`/`--force`/`--poster-only`/`--preview-only`/`--poster-time`.
- **Escalera multi-resolución** (revisado el 5 de septiembre): candidatos a `1280×720`; poster WebP en `320/640/960/1280` (16:9, Lanczos) + alias `.poster.webp` (= 960w); sprite único de 5 cuadros a `960×540` (`4800×540`); manifest `version 2` con `poster.sources[]`. Las fuentes que no son 16:9 se escalan completas y se centran con bandas negras, sin recortar la parte superior ni los costados. Estándar seguido: resolution switching con `srcset` (MDN/web.dev) y escalera 16:9 tipo Vimeo/YouTube.
- Bug corregido: nombres de MP4 con `%` rompían el muxer `image2` de FFmpeg (ruta temporal tratada como patrón printf). Fix: el prefijo temporal no incluye el nombre del vídeo y los archivos intermedios usan nombres fijos; solo el destino final (vía `os.replace`) conserva el nombre real.
- Tests: `scripts/tests/test_generate_vod_posters.py` (5, incluida la escalera de tamaños) — en verde.

**Integración web (local, rama `dev`, sin commitear).**
- `lib/pieroPoster.js`: deriva de un link Piero `posterUrl` (alias), `posterSrcset` (descriptores `w`), `posterSources` (`[{width,url}]`), `previewUrl`, `manifestUrl`. Preserva origen y codificación. `lib/pieroPoster.test.mjs` (4) en verde.
- `components/LiveCard.js`: `LivePoster` con prop `interactive` (true solo en cómoda). Cómoda = card estilo catálogo/YouTube con banner superior, fecha y estado superpuestos, título de dos líneas y administración en menú de tres puntos; tabla = miniatura estática con `srcSet` de densidad (`320w 1x, 640w 2x, 960w 3x`), sin hover; compacta = sin portada. Degradación por capas ante fallo del `<img>`: tamaño del srcset → alias → placeholder "VOD". No usa `live.image`.
- `components/HomePage.js`: se retiró `uploadImage` y el flujo de subida del `TrackerMaintainerModal`; se añadió `<span>Portada</span>` a `.lives-table-header`; se pasa `cardDensity={effectiveCardDensity}` a `LiveCard` **en las tres ramas** (la de tabla no lo hacía y el poster caía en modo cómodo con hover).
- `components/TrackerMaintainerModal.js` / `PlatformTrackerMaintainerPage.js`: retirado el campo `Imagen` y su dropzone. Verificado por el usuario que ya no aparece.
- `app/globals.css`: grid cómodo responsive de tres/dos/una columnas con cards de mínimo aproximado de 320–360 px, banner 16:9 y `object-fit: contain`; columna Portada de tabla sin cambios.
- `npm run build` + lint/types en verde.

**Validación local (Playwright, DPR 1/2/3).** Cómoda: 3 columnas a 1440/1920 px, 2 a 1024/1280 px y también a 768 px, 1 en móvil; cards entre ~515–529 px de alto en los casos medidos, sin overflow horizontal. Fecha/estado permanecen sobre el poster; título ocupa hasta dos líneas; móvil mantiene `356×200`. Compacta no monta portada. Tabla usa miniatura estática, contenido con wrapping legible, acciones directas y una columna de acciones ajustada al contenido. El hover cómodo carga el sprite después de la intención y mantiene la geometría de sus cinco cuadros. El usuario aprobó el cierre visual el 5 de septiembre de 2026.

**Piero — muestra regenerada al formato nuevo.** Septiembre 2026 completo + ~8 MP4 de 2026/2025 que enlazan las cards visibles del Rastreador (incluidos nombres con emoji `🌀`, `+`, puntos `N.A.R.U.T.O.`, `______`). 0 errores. Sirven públicamente los 4 tamaños + alias + sprite + manifest v2.

### Listo para QA / detenido operativamente

- **Backfill masivo detenido.** Hay 1.641 MP4: 774 sets legados con manifest v1, 12 sets nuevos con manifest v2 y 855 MP4 sin portada. Los sets legados siguen visibles vía alias y `--missing-only` los reconoce como incompletos porque no tienen la escalera multirresolución. La revisión visual ya cerró; se mantiene detenido hasta completar commit y smoke test en QA.
- Las sesiones tmux `vod-posters-backfill` y `vod-posters-sweep` en Piero están **detenidas**; los scripts `run-vod-backfill.sh` / `run-vod-sweep.sh` quedan como referencia pero apuntan al bucle por años antiguo.

### Pendiente

1. **Placeholder "VOD"**: hoy ocupa un 16:9 completo; muy alto en móvil. Decisión de diseño aparte (el usuario prioriza escritorio primero).
2. **Backfill incremental** en Piero después del smoke test de QA: `generate-vod-posters.py /archive/drive --recursive --missing-only` en tmux, prioridad baja (`nice`/`ionice`). Actualiza los sets v1, genera los faltantes y omite los v2 completos; es reiniciable sin reprocesar trabajo terminado. Verificar el `Resumen:` y que no queden `ERROR`.
3. **Aislar la feature** del repo web en su propia rama (hoy `dev` mezcla cambios ajenos: `HomePage`/`DetailActivityButtons` de otros trabajos, y varios `.xlsx` sueltos). El usuario hace git manualmente.
4. **QA**: validación visual de cards, tabla y formulario en entorno QA; observación de red y rendimiento; navegación directa e interna a `/rastreador`; importación/exportación XLSX sin pérdida del dato legado.
5. **Ampliar el piloto** a otros tipos de VOD (vertical, con rotación, cortos, corruptos).
6. **Etapa 5 — automatización en el downloader (`kala-stream-downloader`)**: aún sin empezar. La transferencia del MP4 a Piero es un **rsync/cron externo** a ese repo; el hook (`ssh piero python3 /home/piero/tools/generate-vod-posters.py <ruta final>`) debe ir después de esa sincronización. Falta que el usuario indique dónde vive ese rsync/cron y en qué host.
7. Decidir en un cambio separado si se retira `Live.image` del schema/JSON/Postgres y la columna `IMAGEN` del XLSX (requiere auditar su uso, ver más abajo).

Decisiones confirmadas:

- Las portadas se generan a partir de los MP4 alojados en Piero; no se cargan manualmente desde el formulario del Rastreador.
- El formulario completo del Rastreador debe dejar de mostrar el campo `Imagen` y su dropzone.
- Los recursos generados se centralizan bajo `/archive/drive/posters/`, siguiendo el patrón existente de `/archive/drive/subs/` y replicando dentro de `posters/` la jerarquía relativa de los MP4.
- La primera entrega mostrará una portada estática y una secuencia de fotogramas al hacer hover solamente en cards cómodas de escritorio.
- Móvil, densidad compacta, vista tabla y usuarios con `prefers-reduced-motion` conservarán una portada estática.
- Disposición de la portada por densidad (revisado el 5 de septiembre de 2026): **cómoda** = grid responsive estilo catálogo (hasta tres cards por fila), banner superior con preview en hover, fecha abajo a la derecha y estado arriba a la derecha; **compacta** = sin portada; **tabla** = columna `Portada` antes de `Fecha`, miniatura estática y sin bordes redondeados.
- El recurso visual de la tarjeta es la portada de Piero **o** el placeholder "VOD". `live.image` deja de usarse como fallback visual; sus valores heredados no se consideran. Un directo sin fuente Piero (solo OK.RU/Telegram/Patreon) muestra placeholder.
- Las miniaturas de búsqueda sobre la barra del reproductor quedan fuera de la primera entrega. Podrán reutilizar el pipeline posteriormente, pero requieren un storyboard más denso y metadata WebVTT propia.
- No se elimina todavía `Live.image` del schema, JSON, PostgreSQL ni XLSX. Se conserva como dato legado por compatibilidad de importación/exportación, pero ya no alimenta la portada.

## Objetivo funcional

Cada card cómoda del Rastreador debe comunicar visualmente el contenido del directo sin abrir ni reproducir el VOD:

1. Mostrar una portada 16:9 generada automáticamente.
2. En escritorio con puntero preciso, esperar una intención de hover breve y alternar varios fotogramas representativos.
3. No iniciar streams MP4, audio ni múltiples decodificadores de video desde el listado.
4. Mantener una navegación fluida con scroll infinito y hasta cientos de resultados.
5. Degradar a un placeholder estable cuando el directo aún no tenga recursos generados.

## Alcance

### Incluido en la primera entrega

- Script idempotente basado en `ffmpeg` y `ffprobe`.
- Procesamiento de un archivo, varios archivos o únicamente archivos pendientes.
- Portada WebP en escalera de tamaños (320/640/960/1280, `srcset`) y sprite WebP de previsualización.
- Manifest JSON pequeño por video.
- Estructura centralizada en `/archive/drive/posters/`.
- Eliminación de la carga manual de imágenes del formulario del Rastreador.
- Resolución determinística de las URLs de poster desde un link Piero.
- Portada en cards cómodas.
- Preview al hover cargada bajo demanda en desktop.
- Fallback visual y manejo de recursos ausentes o dañados.
- Cache HTTP larga para archivos versionados por nombre y revalidación controlada para reemplazos.
- Verificación visual, funcional, de red y responsive.

### Fuera de alcance inicial

- Reproducción inline del MP4 al estilo YouTube.
- Preview animada en dispositivos táctiles.
- Storyboards/VTT para la línea de tiempo del reproductor.
- Selección o edición manual de portadas desde la web.
- Generación mediante IA dentro del servidor.
- Personalización de portadas por usuario.
- Eliminación de la columna `image` de base de datos o XLSX.
- Procesar OK.RU, Telegram o Patreon como fuentes visuales.

## Referencia de industria y decisión

Se distinguen tres recursos que no deben confundirse:

| Recurso | Uso | Decisión inicial |
|---|---|---|
| Poster estático | Identificar el contenido antes de reproducir | Sí |
| Preview de card | Entender rápidamente el contenido desde el listado | Sí, sprite corto en hover desktop |
| Storyboard de timeline | Buscar un momento al mover el cursor sobre el progreso | Diferido |

YouTube y Vimeo pueden reproducir previews silenciadas sobre la card. Para este proyecto no es la primera opción: los VOD duran horas, el origen es el NAS y el listado puede montar muchas cards. Un sprite de pocos fotogramas limita solicitudes, CPU, batería y diferencias de autoplay entre navegadores, conservando el valor principal de la previsualización.

Los storyboards densos con VTT son adecuados para la barra de reproducción, no para cargar de entrada en cada card. Se documentan como una extensión posterior.

## Arquitectura de archivos en Piero

### Raíces

```text
/archive/drive/          # raíz pública de los VOD
/archive/drive/subs/     # subtítulos centralizados existentes
/archive/drive/posters/  # portadas, previews y manifests generados
```

`/archive/drive/posters/` replica la ruta relativa que existe bajo `/archive/drive/`. No se mezclan los derivados con los MP4 y no se construye un directorio plano.

Ejemplo:

```text
Origen:
/archive/drive/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.mp4

Salidas:
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.poster.webp        # alias = 960w
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.poster-320.webp
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.poster-640.webp
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.poster-960.webp
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.poster-1280.webp
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.preview.webp
/archive/drive/posters/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.preview.json
```

La portada se genera en una escalera de anchos 16:9 (**320, 640, 960, 1280**) servida con `srcset`; el navegador elige según ancho de layout × densidad de pantalla. `*.poster.webp` sin sufijo es un alias del tamaño medio (960w) para `src` por defecto y compatibilidad. El sprite de preview se genera en un solo tamaño (cuadros de **960×540**). Estas medidas están definidas en `POSTER_SIZES` / `SPRITE_FRAME_WIDTH` de `scripts/generate-vod-posters.py` y en `PIERO_POSTER_WIDTHS` de `lib/pieroPoster.js`; cambiarlas exige tocar generador, helper y manifest a la vez.

Esta decisión evita colisiones porque conserva:

- año y mes;
- nombre completo del MP4;
- sufijos de origen como `_twitch` o `_vk`;
- sufijos de duplicado como `(1)` o `(2-2)`;
- cualquier identificador de parte ya presente en el nombre.

El script nunca debe quitar o normalizar sufijos para calcular la salida. Dos MP4 con nombres distintos producen recursos distintos.

### Relación URL

La relación debe ser determinística. Si el link Piero contiene:

```text
/archive/drive/<ruta>/<archivo>.mp4
```

la aplicación deriva:

```text
/archive/drive/posters/<ruta>/<archivo>.poster.webp        # alias 960w
/archive/drive/posters/<ruta>/<archivo>.poster-320.webp
/archive/drive/posters/<ruta>/<archivo>.poster-640.webp
/archive/drive/posters/<ruta>/<archivo>.poster-960.webp
/archive/drive/posters/<ruta>/<archivo>.poster-1280.webp
/archive/drive/posters/<ruta>/<archivo>.preview.webp
/archive/drive/posters/<ruta>/<archivo>.preview.json
```

`lib/pieroPoster.js` deriva de un link Piero: `posterUrl` (alias), `posterSrcset` (descriptores `w` para el banner), `posterSources` (`[{width,url}]`, para el `srcset` con descriptores de densidad de la miniatura de la tabla), `previewUrl` y `manifestUrl`.

Se debe conservar el mismo origen HTTP del link del video y codificar cada segmento de ruta correctamente. No concatenar una URL completa como texto sin usar `URL`, porque los espacios, paréntesis, tildes y caracteres reservados deben preservarse.

La inspección de Piero confirmó que el servicio público monta `/archive/drive` como su raíz `/srv`. Por ello, crear `posters/` dentro de esa raíz lo deja disponible como `/posters/` sin agregar otro mount ni mezclar derivados con los MP4.

### Contenido del manifest

Formato de `*.preview.json` (**version 2**, desde el 5 de septiembre de 2026):

```json
{
  "version": 2,
  "source": "20260904_Ejemplo_twitch.mp4",
  "durationSeconds": 7426.4,
  "posterTimeSeconds": 2599.2,
  "poster": {
    "default": "20260904_Ejemplo_twitch.poster.webp",
    "sources": [
      { "width": 320, "height": 180, "file": "20260904_Ejemplo_twitch.poster-320.webp" },
      { "width": 640, "height": 360, "file": "20260904_Ejemplo_twitch.poster-640.webp" },
      { "width": 960, "height": 540, "file": "20260904_Ejemplo_twitch.poster-960.webp" },
      { "width": 1280, "height": 720, "file": "20260904_Ejemplo_twitch.poster-1280.webp" }
    ]
  },
  "sprite": {
    "file": "20260904_Ejemplo_twitch.preview.webp",
    "frameCount": 5,
    "frameWidth": 960,
    "frameHeight": 540,
    "columns": 5,
    "rows": 1,
    "timesSeconds": [1113.9, 2599.2, 4084.5, 5569.8, 6683.8]
  },
  "generatedAt": "2026-09-05T00:00:00Z"
}
```

Diferencias frente a la version 1: se añade el bloque `poster` con la escalera de tamaños y `sprite.frameWidth`/`frameHeight` pasan de `480×270` a `960×540`. El cliente sigue sin necesitar descargar el manifest (los nombres son deterministas y el contrato de 5 cuadros es fijo); se conserva para diagnóstico y evolución.

No incluir rutas privadas del filesystem, hostname interno, usuario SSH ni otros datos sensibles.

## Script reutilizable

### Ubicación del código

El código fuente debe quedar versionado en este repositorio:

```text
scripts/generate-vod-posters.py
```

Los recursos públicos viven en `/archive/drive/posters/`; el script no debe servirse públicamente desde esa carpeta. Para ejecutarlo en Piero se puede invocar desde un checkout del repositorio o instalar una copia operativa fuera de la raíz pública. Mantener una única fuente versionada evita que la copia del servidor evolucione sin quedar documentada.

### Dependencias

- Python 3.
- `ffmpeg`.
- `ffprobe`.
- Biblioteca estándar de Python como primera opción.

No introducir Pillow, ImageMagick o un servicio de IA en la primera versión salvo que la selección automática no alcance la calidad mínima. La extracción, escalado, composición WebP y mediciones básicas deben resolverse con FFmpeg.

### Interfaz prevista

Procesar un video:

```bash
python3 scripts/generate-vod-posters.py \
  "/archive/drive/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.mp4"
```

Simular sin escribir:

```bash
python3 scripts/generate-vod-posters.py \
  "/archive/drive/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.mp4" \
  --dry-run
```

Procesar una carpeta sin regenerar recursos completos:

```bash
python3 scripts/generate-vod-posters.py \
  "/archive/drive/2026/09 - SEPTIEMBRE" \
  --missing-only
```

Procesar recursivamente todo lo pendiente:

```bash
python3 scripts/generate-vod-posters.py \
  /archive/drive \
  --recursive \
  --missing-only
```

Regenerar explícitamente:

```bash
python3 scripts/generate-vod-posters.py \
  "/archive/drive/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.mp4" \
  --force
```

Opciones requeridas:

```text
--dry-run
--missing-only
--force
--recursive
--poster-only
--preview-only
--output-root <ruta>    # /archive/drive/posters por defecto
--source-root <ruta>    # /archive/drive por defecto
```

`--missing-only` y `--force` deben ser mutuamente excluyentes. Sin `--force`, un conjunto completo existente no se reemplaza. `is_complete()` considera completo un set solo si existen los cuatro posters de la escalera, el alias, el sprite y el manifest: así un set legado de un solo tamaño se regenera con `--missing-only`. El sprite se fija en cinco cuadros porque la card usa ese contrato sin solicitar el manifest cross-origin; cambiar el número de cuadros o los tamaños de `POSTER_SIZES`/`SPRITE_FRAME_*` exige actualizar también `lib/pieroPoster.js` y el manifest.

### Algoritmo de generación

1. Resolver y validar que el input esté dentro de `--source-root`.
2. Aceptar solamente archivos regulares `.mp4` en la primera versión.
3. Leer duración, ancho, alto y rotación mediante `ffprobe`.
4. Rechazar duración inválida o archivo todavía en crecimiento.
5. Excluir los extremos del video; tomar candidatos dentro del tramo aproximado 10–90 %.
6. Extraer entre 8 y 12 candidatos con seek rápido a un lienzo `1280×720`: `scale` proporcional + `pad` centrado, sin deformar ni recortar fuentes con otra relación de aspecto y sin modificar el MP4.
7. Medir con filtros de FFmpeg señales básicas de fotograma negro, luminosidad, contraste y desenfoque.
8. Descartar fotogramas negros, casi uniformes o excesivamente borrosos.
9. Elegir como poster el candidato válido con mejor puntuación.
10. Elegir cinco fotogramas temporalmente separados para la preview, evitando candidatos casi consecutivos.
11. Del candidato-poster, encodear la escalera WebP `320/640/960/1280` (escalado Lanczos) y copiar el de 960w como alias `*.poster.webp`.
12. Encodear el sprite WebP horizontal: cinco cuadros escalados a `960×540` y apilados con `hstack` (`4800×540`).
13. Generar el manifest JSON `version 2` (bloque `poster.sources` + `sprite`).
14. Escribir cada salida en un archivo temporal dentro del directorio final (nombres temporales fijos sin `%`; solo el destino final conserva el nombre real del video).
15. Validar que las salidas no estén vacías y que FFmpeg termine con código cero.
16. Renombrar atómicamente los temporales a los nombres finales.
17. Eliminar únicamente los temporales creados por esa ejecución si ocurre un error.
18. Informar resumen: procesados, omitidos, errores y ruta de cada salida.

### Idempotencia y concurrencia

- Un set se considera completo solo si existen poster, sprite y manifest válidos.
- Si falta una pieza, `--missing-only` regenera el set completo para mantener consistencia.
- Crear un lock por video dentro del directorio de salida. Si ya existe un proceso activo, omitir ese video con mensaje claro.
- El lock debe limpiarse normalmente y poder detectarse como obsoleto mediante PID/edad.
- Nunca escribir sobre un archivo final durante el procesamiento.
- No borrar MP4, VTT, backups ni derivados ajenos.

### Selección manual excepcional

La operación habitual será automática. Cuando la portada elegida no sea representativa, debe ser posible regenerar solo el poster indicando un instante:

```bash
python3 scripts/generate-vod-posters.py \
  "/archive/drive/2026/09 - SEPTIEMBRE/20260904_Ejemplo_twitch.mp4" \
  --poster-only \
  --poster-time 01:12:35 \
  --force
```

Esto permite que el usuario ejecute una corrección sin entrar al formulario web ni editar código.

## Resolución de la portada de cada directo

Un directo puede contener varias partes Piero. Para evitar animaciones mezcladas o una card que cambie de identidad:

1. Usar como fuente visual la primera URL Piero válida del orden guardado en `live.links.piero`.
2. Derivar poster, sprite y manifest desde esa misma parte.
3. Si esa parte todavía no tiene poster disponible, mostrar placeholder; no cambiar silenciosamente de parte ni intentar extraer imágenes desde el navegador.
4. No usar OK.RU como fallback automático por restricciones cross-origin y dependencia externa.

La elección de la primera parte debe permanecer estable. Si el administrador reordena las URLs Piero, la portada principal puede cambiar de forma coherente con el nuevo orden.

## Integración web

### Cambios de datos

No se requiere migración Prisma para la primera entrega.

Crear un helper puro, por ejemplo:

```text
lib/pieroPoster.js
```

Responsabilidades:

- validar que una URL corresponda a una ruta Piero soportada;
- derivar URLs de poster (alias + escalera `srcset`), sprite y manifest;
- preservar origen y codificación;
- devolver `null` ante rutas no soportadas;
- ser comprobable con tests unitarios sin acceso de red.

No se persisten esas URLs en `Live.image`, porque son derivables, y `Live.image` **ya no alimenta la portada** (ni siquiera como fallback). Queda como dato legado solo para el contrato de importación/exportación. Antes de retirarlo del schema/XLSX se debe auditar su uso en:

- `lib/lives.js`;
- `lib/liveDbMapping.js`;
- `lib/trackerSpreadsheet.js`;
- `lib/trackerValidation.js`;
- APIs web y móvil;
- datos JSON existentes.

### Retirar el campo del formulario

En `components/TrackerMaintainerModal.js`:

1. Eliminar la sección visible `Imagen`.
2. Eliminar dropzone, preview, estados de archivo y mensajes exclusivos de esa sección.
3. Eliminar imports que queden sin uso.
4. Dejar de enviar `imageFile` desde ese formulario.
5. Al editar, preservar internamente el valor legado de `live.image` para no borrarlo accidentalmente.
6. Al crear, utilizar cadena vacía o el default actual hasta que se retire formalmente el campo.

En `components/PlatformTrackerMaintainerPage.js`:

1. Retirar únicamente el flujo de upload iniciado por `TrackerMaintainerModal`.
2. No eliminar `/api/upload`: otras features de la aplicación lo utilizan.
3. Confirmar que crear y editar directos continúa funcionando en formulario completo y compacto.

No modificar todavía la columna `IMAGEN` del XLSX; registrarla como deuda de compatibilidad y decidirla después de desplegar la generación automática.

### Card por densidad

En `components/LiveCard.js` (implementado el 5 de septiembre de 2026):

1. `showThumbnail` resuelve el poster real desde URLs Piero mediante `getLivePosterResources`.
2. El componente `LivePoster` acepta `interactive`: solo la densidad **cómoda** lo recibe `true` (hover con preview); compacta y tabla lo reciben `false` (portada estática, sin timers ni elemento de preview).
3. Poster inicial = `resources.posterUrl` (alias 960w). Degradación por capas ante fallo del `<img>`: (a) si falla un tamaño del `srcset` se reintenta solo con el alias (`srcsetFailed`); (b) si el alias también falla, placeholder "VOD". Sin `live.image`. Un 404 cross-origin servido como HTML puede bloquearse por **ORB** y disparar `load` (imagen vacía) en vez de `error`, y el `error` de pre-hidratación no llega a React: por eso además de `onError`/`onLoad` hay un `useEffect` con `ref` que detecta `img.complete && naturalWidth === 0` al montar. Esto mantiene visibles los sets legados (un solo tamaño) hasta el backfill completo.
4. `cardDensity` decide el modo: `LiveCard` recibe `cardDensity={effectiveCardDensity}` en **las tres** ramas de `components/HomePage.js` (la rama de tabla no lo pasaba y el poster caía por defecto en modo cómodo). `interactive = cardDensity === "comfortable"`.
5. Contenedor 16:9 estable para evitar layout shift; `<img loading="lazy" decoding="async">`. En **cómoda** el `<img>` lleva `srcSet={resources.posterSrcset}` (descriptores `w`) + `sizes={PIERO_POSTER_BANNER_SIZES}`; en **tabla** lleva `srcSet` con descriptores de densidad (`320w 1x, 640w 2x, 960w 3x`) construido desde `resources.posterSources`, sin `sizes` ni hover.
6. El click de la superficie visual abre el detalle sin interceptar acciones internas de la card.
7. Disposición: **cómoda** usa hasta tres columnas y monta el poster como banner superior; fecha/estado son overlays interactivos, el título se limita visualmente a dos líneas y notificar/editar se agrupan en un menú de tres puntos junto al CTA. **Compacta** no monta portada. **Tabla** usa miniatura estática, placeholder reducido y encabezado de mayor contraste; tags, disponibilidad y acciones mantienen espacio natural y wrapping legible, sin un scroll vertical interno ni menú administrativo superpuesto.

### Preview al hover

1. Activarla únicamente cuando coincidan `hover: hover` y `pointer: fine`.
2. Esperar entre 400 y 500 ms antes de solicitar el manifest/sprite.
3. Cancelar el temporizador si el puntero sale antes.
4. Cargar el sprite solamente después de confirmar intención.
5. Alternar sus cinco posiciones aproximadamente cada 800 ms.
6. Permitir una sola animación activa en la página.
7. Detenerla al salir de la card, perder visibilidad la pestaña o salir la card del viewport.
8. Volver al poster inmediatamente al detenerse.
9. No animar con `prefers-reduced-motion: reduce`.
10. No agregar audio, controles ni progreso; sigue siendo una preview, no un player.

El manifest puede evitarse en el cliente inicial: los nombres son deterministas, la portada usa `srcset` con la escalera conocida y el sprite tiene un contrato fijo de cinco cuadros a `960×540`. Se conserva de todos modos para diagnóstico, evolución del formato y futura integración de timeline.

### Estilos

Actualizar `app/globals.css` reutilizando la estética actual:

- superficie sólida y borde sutil;
- relación 16:9;
- `object-fit: contain` para mostrar el fotograma completo sin recortar sus bordes;
- relación 16:9 real sin limitar la altura del banner de manera independiente;
- transición corta de opacidad entre poster y preview;
- sin escalados grandes, blur, `backdrop-filter`, sombras extensas ni hover con `transform`;
- skeleton o placeholder sobrio, sin animación permanente;
- foco visible para navegación por teclado.

## Caché y entrega HTTP

Los WebP y JSON deben ser servidos por el servicio de archivos actual, no por Next.js ni PostgreSQL. La infraestructura inspeccionada usa un contenedor Caddy cuya raíz `/srv` está montada desde `/archive/drive`; el dominio público actual entrega los videos mediante ese servicio. Por lo tanto, `/archive/drive/posters/` queda bajo la misma raíz y no requiere una nueva ubicación Nginx.

Antes de cambiar Caddy, el contenedor o sus mounts, validar primero que un archivo piloto en `/archive/drive/posters/` responde públicamente bajo `/posters/`. Solo agregar headers o reglas específicas si la prueba demuestra que faltan MIME, CORS o caché.

Como los nombres son determinísticos y `--force` puede reemplazar contenido, se propone un TTL inicial de un día, no `immutable`. Si más adelante el nombre incorpora hash o versión, se puede usar caché larga e inmutable.

Verificar MIME:

```text
.webp  -> image/webp
.json  -> application/json
```

## Plan de implementación por etapas

No avanzar automáticamente a producción. Cada etapa debe registrar fecha, commit, entorno y resultado.

Estado de las etapas al 5 de septiembre de 2026:

| Etapa | Estado |
|---|---|
| 0 — inventario e infraestructura | **Completada.** |
| 1 — script y pruebas locales | **Completada** e iterada a multi-resolución + fix de `%`. Tests en verde. |
| 2 — piloto en Piero | **Completada** con la muestra al nuevo formato (septiembre 2026 + ~8 MP4). |
| 3 — integración web sin hover | **Completada en local** (poster/fallback, retiro del campo Imagen, columna Portada de tabla). Falta commitear y QA. |
| 4 — preview de card bajo demanda | **Completada en local** (hover con intención, una preview activa, gating por `hover/pointer/reduced-motion`). Falta QA en navegadores reales. |
| 5 — backfill y automatización | **Pendiente.** Revisión visual cerrada; backfill incremental `--missing-only` listo para reanudarse después de QA. Hook en el downloader sin empezar. |
| 6 — observación y cierre | **Pendiente.** |

### Etapa 0: inventario y validación de infraestructura

1. Revisar `git status`, `git diff` y cambios ajenos.
2. Conectar con `ssh piero` en modo de consulta.
3. Confirmar rutas reales, propietario, grupo y permisos de `/archive/drive/`.
4. Confirmar el mount del servicio Caddy que publica `/archive/drive/` sin imprimir secretos.
5. Confirmar versiones y soporte WebP de `ffmpeg`/`ffprobe`.
6. Seleccionar tres videos de prueba: corto/normal, varias horas y nombre con espacios/paréntesis/sufijo.
7. Medir tamaño y duración, pero no modificar los videos.
8. Confirmar espacio disponible para `/archive/drive/posters/`.
9. Estimar peso medio del poster y sprite con una muestra temporal en `/tmp`.

Criterio de salida: estructura y publicación confirmadas, FFmpeg compatible, muestra representativa definida y ningún cambio en los MP4.

Rollback: no aplica; etapa de solo lectura y temporales descartables.

### Etapa 1: script y pruebas locales controladas

1. Crear `scripts/generate-vod-posters.py`.
2. Implementar CLI, validaciones, mapeo de rutas y `--dry-run`.
3. Implementar extracción y puntuación de candidatos.
4. Implementar poster, sprite, manifest, temporales y rename atómico.
5. Implementar locks e idempotencia.
6. Agregar tests del mapeo de rutas y argumentos.
7. Ejecutar el script contra copias o muestras en `/tmp`.
8. Inspeccionar visualmente todas las salidas.
9. Comprobar nombres con espacios, tildes, paréntesis, `_vk`, `_twitch` y partes duplicadas.
10. Comprobar `--missing-only`, `--force`, error interrumpido y recuperación.

Criterio de salida: el script nunca modifica el origen, genera tres archivos válidos de forma atómica y puede repetirse sin resultados divergentes inesperados.

Rollback: eliminar únicamente los temporales o derivados generados en el directorio de prueba; conservar los MP4 intactos.

### Etapa 2: piloto en Piero

1. Crear `/archive/drive/posters/` con propietario/grupo compatibles con el proceso operativo y lectura para el servicio de archivos.
2. Copiar o disponer la versión del script correspondiente al commit probado.
3. Ejecutar primero `--dry-run` sobre los tres videos seleccionados.
4. Generarlos sin `--force`.
5. Validar archivos con `file`, `ffprobe` o decodificación FFmpeg.
6. Abrir poster y sprite desde filesystem para revisión visual.
7. Confirmar que el mount existente publica `/archive/drive/posters/` como `/posters/`, sin cambiar configuración si ya funciona.
8. Consultar headers HTTP, MIME, CORS, caché y códigos 404.
9. Medir tiempo de generación, CPU, I/O y tamaño final.

Criterio de salida: tres conjuntos accesibles por HTTPS, sin cambios a los videos y sin errores nuevos del servicio de archivos.

Rollback: eliminar únicamente los derivados del piloto identificados explícitamente. Si se hubiera requerido una regla Caddy, retirarla y validar la configuración antes de recargar. No eliminar `/archive/drive/` ni usar rutas amplias.

### Etapa 3: integración web sin hover

1. Crear el helper de URLs derivadas y sus tests.
2. Retirar el campo Imagen del formulario completo.
3. Preservar datos `image` legados al editar.
4. Activar poster y fallback únicamente en card cómoda.
5. Verificar card compacta, tabla y exportación/importación existentes.
6. Probar creación y edición de directos con ambos formularios.
7. Ejecutar pruebas visuales responsive.
8. Ejecutar `npm run build`.
9. Entregar a QA antes de procesar todo el catálogo.

Criterio de salida: cards con poster estable, formularios sin upload manual y cero regresiones en administración, listado o detalle.

Rollback: revertir mediante un commit nuevo la integración visual y restaurar el formulario. Los derivados de Piero pueden permanecer porque no afectan la app anterior.

### Etapa 4: preview de card bajo demanda

1. Implementar detección de hover/puntero y movimiento reducido.
2. Agregar espera de intención.
3. Cargar sprite bajo demanda.
4. Animar posiciones sin montar `<video>`.
5. Garantizar una sola preview activa.
6. Detener timers/observers al desmontar cards durante filtros o navegación.
7. Inspeccionar Network: ningún sprite debe descargarse sin hover.
8. Inspeccionar Performance y memoria durante scroll/hover repetido.
9. Validar Chromium, Firefox y Safari desktop.
10. Ejecutar `npm run build`.

Criterio de salida: el hover aporta información sin solicitudes iniciales adicionales de sprites, timers huérfanos, saltos de layout ni animación táctil.

Rollback: desactivar el comportamiento de preview y conservar únicamente posters estáticos.

### Etapa 5: backfill y automatización

1. Ejecutar inventario con `--dry-run --recursive --missing-only`.
2. Registrar cantidad y espacio estimado antes de escribir.
3. Ejecutar por año o mes, no todo el archivo a ciegas.
4. Usar `tmux` y conservar log sin secretos.
5. Verificar resumen después de cada lote.
6. Reintentar solo errores explícitos.
7. Integrar la generación en el downloader después de faststart y rsync exitosos.
8. El downloader debe ejecutar la generación remota solo cuando el MP4 final ya esté cerrado y estable.
9. Un fallo de poster debe marcar advertencia/reintento, pero no borrar ni recodificar nuevamente el MP4 transferido.
10. Procesar automáticamente Twitch y VK usando el nombre final, incluidos sus sufijos.

Criterio de salida: nuevos videos producen derivados sin intervención, el backfill está completo o sus omisiones están documentadas y no existen colisiones.

Rollback: retirar la llamada automática del downloader mediante un commit nuevo. Los posters ya generados son derivados reconstruibles y pueden conservarse hasta decidir su limpieza.

### Etapa 6: observación y cierre

1. Medir errores de poster/preview y 404 durante una semana.
2. Comparar peso transferido del Rastreador antes y después.
3. Confirmar ausencia de regresiones de scroll y parpadeo.
4. Revisar comportamiento real en desktop y móvil.
5. Decidir si retirar `Live.image` y `IMAGEN` del XLSX en un cambio separado.
6. Decidir si crear storyboard/VTT para el reproductor.
7. Actualizar `docs/project-overview.md`, `docs/backlog.md` y este documento con el resultado final.

Criterio de salida: operación estable, generación documentada y deuda restante explícita.

## Verificación requerida

### Script

- MP4 horizontal, vertical y con metadata de rotación.
- Video largo y video corto.
- Nombre con espacios, tildes, paréntesis y sufijos Twitch/VK.
- Archivo incompleto o todavía creciendo.
- Archivo corrupto.
- Ejecución repetida.
- Interrupción antes del rename final.
- Dos ejecuciones simultáneas sobre el mismo archivo.
- Falta de espacio o permisos en salida.

### Web funcional

- Acceso directo a `/rastreador`.
- Navegación interna hacia Rastreador.
- Scroll infinito y cambio de filtros.
- Card cómoda con recursos completos.
- Card cómoda sin poster.
- Recurso 404 o WebP corrupto.
- Cards con una y varias partes Piero.
- Directo sin Piero y con OK.RU.
- Crear y editar desde formulario completo y compacto.
- Importar/exportar XLSX sin pérdida involuntaria del dato legado.

### Visual responsive

Revisar como mínimo las resoluciones de `docs/workflows/new-feature.md`:

- `320 x 1080`;
- `360 x 740`;
- `390 x 844`;
- `430 x 932`;
- `768 x 1024` y `768 x 1080`;
- `900 x 900`;
- `1024 x 1080`;
- `1280 x 900`;
- `1440 x 1080`.

Estados adicionales:

- densidad cómoda, compacta y tabla;
- sidebar abierto/cerrado donde aplique;
- hover sostenido y salida rápida;
- navegación por teclado;
- `prefers-reduced-motion`;
- touch emulado sin preview accidental.

### Red y rendimiento

- El HTML inicial no descarga sprites.
- Las imágenes fuera del viewport mantienen lazy loading.
- Solamente la card activa descarga su preview.
- No aparecen solicitudes Range del MP4 desde las cards.
- No aumenta el número de listeners/timers después de filtrar repetidamente.
- El servicio de archivos entrega MIME y Cache-Control esperados.
- Next.js y PostgreSQL no intervienen al servir WebP/JSON.

## Archivos probables

### Creados (hechos)

- `scripts/generate-vod-posters.py` + `scripts/tests/test_generate_vod_posters.py`
- `lib/pieroPoster.js` + `lib/pieroPoster.test.mjs`
- En Piero: `/home/piero/tools/generate-vod-posters.py` (copia operativa), `run-vod-backfill.sh`, `run-vod-sweep.sh` (referencia)

### Modificados (hechos)

- `components/TrackerMaintainerModal.js` — retirado el campo Imagen y su dropzone
- `components/PlatformTrackerMaintainerPage.js` — retirado el flujo de upload del modal (sin tocar `/api/upload`)
- `components/LiveCard.js` — `LivePoster`, `srcset`, degradación por capas, `interactive`
- `components/HomePage.js` — retiro de `uploadImage`, `<span>Portada</span>`, `cardDensity` en las 3 ramas
- `app/globals.css` — grid cómodo responsive, overlays del poster, menú de administración, columna Portada de tabla y preview estática/animada
- este documento

### Pendientes de tocar

- `docs/project-overview.md`, `docs/backlog.md` — al cerrar la feature
- `kala-stream-downloader` — Etapa 5

### No eliminar en la primera entrega

- `Live.image` en `prisma/schema.prisma`
- compatibilidad `image` JSON/Postgres
- columna `IMAGEN` de `lib/trackerSpreadsheet.js`
- `app/api/upload` y flujos de imágenes usados por anime u otras features

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Elegir una pantalla negra o poco representativa | Varios candidatos, filtros de calidad y `--poster-time` manual |
| Sobrecargar el NAS con previews | Sprites pequeños, carga por intención, una preview activa y caché HTTP |
| Colisión entre Twitch, VK o partes | Replicar jerarquía y conservar nombre/sufijo completo |
| Procesar un MP4 todavía en escritura | Validar estabilidad de tamaño/fecha y ejecutar después del flujo final |
| Archivos parciales por interrupción | Temporales y rename atómico |
| Regeneración inconsistente | Set completo, manifest versionado y `--force` explícito |
| Problemas con espacios o tildes | `pathlib`, argumentos sin shell y tests con nombres reales |
| Parpadeo o scroll costoso | Sin `<video>`, sin transform, preview única y observación real |
| Caché conserva una portada reemplazada | TTL inicial moderado; versionado/hash futuro si hace falta |
| Eliminación del upload rompe otras áreas | Retirar solo el flujo del Rastreador; conservar endpoint compartido |

## Rollback general

La feature está diseñada para degradar por capas:

1. Desactivar preview y conservar posters.
2. Desactivar posters en `LiveCard` y conservar derivados en Piero.
3. Restaurar el campo del formulario mediante un commit nuevo si fuese necesario.
4. Retirar la automatización del downloader sin tocar los MP4.
5. Retirar cualquier regla Caddy agregada solo después de validar su configuración; si el mount existente fue suficiente, no existe configuración que revertir.

No usar `git reset --hard`, no borrar `/archive/drive/` y no ejecutar eliminaciones recursivas sobre `/archive/drive/posters/` sin listar y validar primero los objetivos exactos.

## Prompt de continuidad para otra IA

Copiar el siguiente prompt y reemplazar únicamente la etapa:

```text
Trabaja en el repositorio /Users/gabriel/Developer/kala-apps/lolweapon-resubidos-web.

Antes de proponer o ejecutar cambios:
1. Lee completamente AGENTS.md y respeta sus instrucciones.
2. Lee CLAUDE.md, docs/project-overview.md, docs/backlog.md, docs/workflows/new-feature.md y docs/operations/vod-posters-plan.md.
3. Revisa git status, git diff y el historial reciente. El worktree puede contener archivos o cambios del usuario: no los reviertas, borres ni sobrescribas.
4. Comprueba el estado real de la etapa; no confundas cambios locales, QA, producción o archivos generados en Piero.

Continúa con la etapa [INDICAR NÚMERO Y NOMBRE] de docs/operations/vod-posters-plan.md. El alias SSH del NAS es `piero` (servidor de vídeos) y `lolweapon` es el de la web. Las consultas seguras y no destructivas están autorizadas; antes de escribir en Piero, cambiar Caddy/Nginx, crear directorios del sistema o eliminar derivados, explica los objetivos exactos y entrega los comandos para aprobación o ejecución manual según corresponda.

Próximos pasos concretos (ver la lista **Pendiente** al inicio del documento): (a) crear el commit acotado y desplegarlo en QA; (b) ejecutar el smoke test visual, funcional y de red; (c) reanudar el backfill incremental `--missing-only` en Piero; (d) completar la Etapa 5 en `kala-stream-downloader`, enganchando `generate-vod-posters.py` vía `ssh piero` después del rsync/cron externo que sube el MP4 (falta localizar ese proceso).

La raíz original es /archive/drive/ y la raíz centralizada de derivados es /archive/drive/posters/. Conserva la jerarquía relativa y el nombre completo del MP4 para evitar colisiones entre Twitch, VK, partes y duplicados. Nunca modifiques ni borres los MP4. No imprimas secretos, valores de .env, tokens, credenciales, IPs privadas ni argumentos sensibles de procesos.

El código fuente del generador debe quedar versionado como scripts/generate-vod-posters.py. El formulario del Rastreador deja de ofrecer carga manual, pero Live.image, la columna IMAGEN del XLSX y /api/upload se mantienen temporalmente por compatibilidad. La card cómoda usa poster estático (banner superior, `srcset` con escalera 320/640/960/1280) y preview por sprite (`960×540`) solo bajo hover desktop; la tabla usa una columna Portada con miniatura estática; compacto no muestra portada; móvil y reduced motion quedan estáticos. `live.image` no alimenta la portada. El manifest es `version 2` (bloque `poster.sources`). Cambiar tamaños o número de cuadros obliga a tocar a la vez `POSTER_SIZES`/`SPRITE_FRAME_*` del generador, `PIERO_POSTER_WIDTHS` de `lib/pieroPoster.js` y el manifest.

Al terminar una etapa, actualiza el estado de este documento con fecha, commit/entorno cuando existan, verificaciones, resultados, rollback y siguiente paso. Ejecuta npm run build después de cambios de código. Yo ejecuto manualmente git add, commit, tag y push salvo que solicite expresamente lo contrario.
```

## Regla de continuidad

Una etapa no se considera terminada porque el código exista. Debe cumplir su criterio de salida, registrar evidencia y dejar indicado el siguiente paso exacto. Si durante la implementación se cambia la estructura de `/archive/drive/posters/`, el contrato del manifest o la prioridad de fuentes, actualizar primero este documento para evitar que web, generador y automatización adopten convenciones diferentes.
