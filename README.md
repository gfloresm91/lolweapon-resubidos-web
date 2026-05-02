# Lolweapon Resubidos Web

Archivo historico de directos y VODs migrado a Next.js full stack.

La aplicacion permite:

- mostrar un inicio con player/chat de Twitch, metadata del canal, ultimos directos y ultimos videos de YouTube
- explorar el archivo historico por busqueda, año, estado y tags
- abrir una pagina de detalle por resubido con player OK.RU, selector de partes y links relacionados
- administrar una `Biblioteca de anime` separada entre animes en `Viendo` y terminados
- publicar una sección de manga `SpaceDrum` con ficha y lector
- visualizar enlaces por plataforma (`OK.RU`, `Telegram`, `Patreon`)
- reproducir embeds de `OK.RU` sin salir de la app cuando el link lo permite
- mostrar redes oficiales en el menu lateral
- abrir el rastreador desde animes con filtros preaplicados
- administrar el archivo desde una interfaz protegida por login
- administrar categorias globales de tags desde la interfaz admin
- crear y editar fichas de anime con metadata de AniList bajo demanda
- guardar los cambios sobre un dataset base o sobre un dataset local opcional
- subir miniaturas desde la interfaz admin

## Stack

- `Next.js` App Router
- `React 19`
- `Route Handlers` para la API
- `react-hook-form` + `zod` para validaciones del admin
- `lucide-react` para iconos de navegacion
- `sonner` para toasts
- persistencia local en JSON

## Requisitos

- `Node.js 20+` recomendado
- `npm`

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Crea tu archivo de entorno:

```bash
cp .env.example .env
```

3. Define al menos estas variables:

```env
ADMIN_PASSWORD=tu-password
ADMIN_SESSION_TOKEN=un-token-largo-y-privado
```

Sugerencia para generar `ADMIN_SESSION_TOKEN`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Coloca tus datasets base en:

```text
data/data.json
data/anime-metadata.json
data/tag-settings.json
```

Opcional, si quieres trabajar sin modificar los archivos versionados:

```bash
cp data/data.json data/data.local.json
cp data/anime-metadata.json data/anime-metadata.local.json
cp data/tag-settings.json data/tag-settings.local.json
```

Si existe un archivo `.local.json`, la app lo usará en lugar del archivo base equivalente para leer y guardar cambios.

5. Levanta el entorno de desarrollo:

```bash
npm run dev
```

6. Abre:

```text
http://localhost:3000
```

Para acceder al panel admin:

```text
http://localhost:3000/login
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run enrich:anime
```

Nota: en `Next.js 15`, `next lint` está deprecado. Si el proyecto no tiene una configuración ESLint creada, `npm run lint` puede abrir un asistente interactivo de configuración. Para verificación no interactiva, `npm run build` compila, valida tipos y recolecta las rutas.

`npm run enrich:anime` consulta AniList para completar metadata faltante en `data/anime-metadata.json`. Es una herramienta de mantenimiento masivo; para administración diaria se recomienda usar el botón `Completar desde AniList` dentro del modal de la Biblioteca de anime.

## Variables de entorno

El proyecto usa estas variables:

- `ADMIN_PASSWORD`
  Contraseña del panel admin.
- `ADMIN_SESSION_TOKEN`
  Token secreto usado para validar la cookie de sesión.
- `RESUBIDOS_HOST`
  Host que debe cargar `/rastreador` cuando se visita la raíz. Ejemplo QA: `resubidos-qa.lolweapon.com`.
- `VIENDO_HOST`
  Host que debe cargar `/biblioteca-anime/viendo` cuando se visita la raíz. Ejemplo QA: `viendo-qa.lolweapon.com`.
- `TWITCH_CLIENT_ID`
  Client ID de la aplicación de Twitch.
- `TWITCH_CLIENT_SECRET`
  Client secret de la aplicación de Twitch.
- `TWITCH_BROADCASTER_LOGIN`
  Login del streamer en Twitch, usado cuando el evento no incluye user id.
- `TWITCH_EVENTSUB_SECRET`
  Secreto para verificar los webhooks de Twitch EventSub.
- `TWITCH_EVENTSUB_CALLBACK_URL`
  URL publica HTTPS del listener, por ejemplo `https://tu-dominio.com/api/twitch/eventsub`.
- `TWITCH_ARCHIVE_TIME_ZONE`
  Zona horaria para guardar la fecha del directo. Por defecto: `America/Santiago`.
- `TWITCH_REQUIRE_ACTIVE_STREAM`
  Si vale `true`, la app solo crea registro cuando Twitch confirma que el canal está online.
- `YOUTUBE_API_KEY`
  API key de YouTube Data API para cargar videos recientes en Inicio.
- `YOUTUBE_CHANNEL_ID`
  ID del canal de YouTube. La app lo usa para resolver la playlist de subidas si no defines `YOUTUBE_UPLOADS_PLAYLIST_ID`.
- `YOUTUBE_CHANNEL_URL`
  URL publica del canal de YouTube para el boton `Ir al canal` en Inicio. Es opcional; si no existe, la app usa `YOUTUBE_CHANNEL_ID` o un fallback local.
- `YOUTUBE_UPLOADS_PLAYLIST_ID`
  Playlist de subidas del canal. Si la tienes, es la forma más directa para listar los últimos videos.
- `UPLOAD_DIR`
  Carpeta donde se guardan las imagenes subidas desde el admin. Por defecto: `public/imagenes`.
- `NEXT_PUBLIC_ENABLE_SPACEDRUM`
  Feature flag para mostrar la sección `/spacedrum` y su item de menú. Por defecto debe quedar en `false` hasta que la página esté lista para producción.

Notas:

- si no defines estas variables, el proyecto tiene valores por defecto pensados solo para entorno local
- no uses esos valores por defecto en produccion

## Estructura del proyecto

```text
app/
  api/
    anime-library/
      route.js
      anilist/route.js
    lives/route.js
    login/route.js
    logout/route.js
    tags/route.js
    twitch/
      archive/route.js
      eventsub/
        route.js
        subscribe/route.js
      status/route.js
    update/route.js
    upload/route.js
    youtube/
      videos/route.js
  inicio/page.js
  imagenes/
    [filename]/route.js
  login/page.js
  layout.js
  page.js
  rastreador/
    page.js
    [id]/page.js
  biblioteca-anime/
    page.js
    viendo/page.js
    terminados/page.js
  spacedrum/page.js
  globals.css

components/
  AdminModal.js
  ConfirmModal.js
  DetailTopbarActions.js
  FiltersBar.js
  HomeDashboard.js
  HomePage.js
  AnimeLibraryPage.js
  LiveCard.js
  LoreModal.js
  OkruWatchPlayer.js
  SpaceDrumPage.js
  SocialLinks.js
  StatsBar.js
  TagPanel.js
  TagsInput.js

lib/
  animeLibrary.js
  auth.js
  data.js
  lives.js
  spacedrum.js
  tagSettings.js
  tags.js
  twitch.js
  twitchArchive.js
  youtube.js

data/
  data.json
  data.local.json
  anime-metadata.json
  anime-metadata.local.json
  spacedrum.json
  spacedrum.local.json
  tag-settings.json
  tag-settings.local.json

public/
  brand/
    lolweapon-logo.png
  imagenes/

middleware.js
```

## Como funciona la app

### Rutas y dominios

Rutas internas:

- `/inicio`: hub principal con Twitch, últimos directos y YouTube.
- `/rastreador`: archivo de directos/resubidos.
- `/biblioteca-anime/viendo`: biblioteca de animes en seguimiento, comprados o pendientes de compra.
- `/biblioteca-anime/terminados`: biblioteca de animes terminados.
- `/spacedrum`: ficha y lector del manga SpaceDrum.

En producción, el middleware reescribe la raíz según el dominio:

- `${RESUBIDOS_HOST}/` carga `/rastreador`.
- `${VIENDO_HOST}/` carga `/biblioteca-anime/viendo`.

### Frontend publico

`/inicio`:

- muestra el player y chat de Twitch
- el player usa el SDK oficial de Twitch para intentar autoplay muteado al cargar y cuando detecta estado online
- el iframe de Twitch se monta como player persistente para pasar de Inicio a Rastreador o Ver resubido sin reiniciar la reproducción
- consulta `/api/twitch/status` para mostrar si el canal esta online
- muestra metadata del canal aunque el streamer este offline
- muestra avatar del streamer, titulo actual, categoria e imagen de categoria
- incluye boton de apoyo hacia Streamlabs/PayPal
- muestra los 10 registros mas recientes del rastreador
- en los registros recientes muestra los enlaces reales por plataforma, priorizando `OK.RU` antes que `Telegram`
- muestra los 10 videos mas recientes de YouTube
- incluye un boton `Ir al canal` que usa `YOUTUBE_CHANNEL_URL`, `YOUTUBE_CHANNEL_ID` o un fallback

`/rastreador`:

- carga el dataset inicial desde servidor
- aplica filtros por texto, año, mes, estado y tag
- el filtro de mes se habilita solo al seleccionar un año y muestra solo meses con data en ese año
- puede recibir filtros iniciales por query params
- usa controles custom para año y estado, evitando los selects nativos en móvil
- muestra estadisticas generales
- renderiza cards con información, tags, disponibilidad por plataforma y CTA hacia el detalle
- resalta coincidencias del texto buscado dentro de titulo, preview y tags
- conserva el campo `image`, pero por ahora oculta las miniaturas en los cards del rastreador
- permite filtrar por año o estado haciendo click en la fecha o estado de una card
- permite alternar entre `Comodo` como cards y `Compacto` como tabla
- agrupa tags en categorias automaticas como Anime, Juegos, Tiers, Charlas, Peliculas y Otros
- carga categorias personalizadas y movimientos manuales desde `/api/tags`
- usa scroll infinito ligero para cargar resultados por bloques sin romper el layout

`/rastreador/[id]`:

- carga un registro concreto del rastreador por `id`
- mantiene el mismo shell visual de la app: menu lateral, topbar y footer persistente
- muestra una pagina tipo watch page con player principal, metadata, tags, descripcion y links
- convierte links `https://ok.ru/video/<id>` o `https://ok.ru/videoembed/<id>` en iframes `https://ok.ru/videoembed/<id>`
- cuando hay varias partes de `OK.RU`, permite cambiar la parte sin abrir una pestaña nueva
- actualiza la URL con `?parte=N` para compartir una parte concreta
- recuerda la ultima parte vista por resubido usando `localStorage`
- permite compartir la parte activa y abrir externamente la parte activa de `OK.RU`
- muestra un estado de carga al cambiar de parte y lo limpia con fallback si el iframe de OK.RU no emite `load`
- incluye un modal `Descargar` con comando local de Streamlink, enlaces de instalacion y notas de FFmpeg
- incluye modo teatro para enfocar el player
- soporta atajos: `Esc` sale de modo teatro, `T` alterna modo teatro, flechas izquierda/derecha cambian parte, `C` copia la parte activa
- muestra fallback hacia Telegram cuando no hay player OK.RU reproducible
- incluye navegación `Anterior` y `Siguiente` ordenada por fecha ascendente
- incluye un link `Reportar link caido` que prepara un correo hacia `kalathraslolweaponvods@gmail.com`

Al entrar al detalle desde una card:

- el rastreador guarda temporalmente filtros, tag, cantidad visible, scroll y card actual en `sessionStorage`
- al volver con `Volver al rastreador`, restaura el estado y vuelve a la posición aproximada de la card

`/biblioteca-anime/viendo`:

- carga fichas desde `data/anime-metadata.json` o `data/anime-metadata.local.json`
- cruza esas fichas con los tags categorizados como `Anime` en `data/tag-settings.json`
- muestra indicadores consistentes por cantidad de animes: total, temporada entera, con caps comprados y sin comprar
- muestra el total de capitulos comprados como detalle secundario del indicador correspondiente
- permite filtrar por `Entera`, `Caps comprados` y `Sin comprar`
- muestra cards horizontales con imagen, titulo, progreso visto, estado de compra y acceso `Ver resubidos`
- calcula la barra de progreso con `currentEpisode / episodes`; si `episodes` está vacio, solo muestra el capitulo actual
- si hay sesion admin, permite crear y editar fichas, subir poster, actualizar capitulo actual, marcar capitulos comprados o `ENTERA`
- si hay sesion admin, permite completar metadata desde AniList sin guardar automaticamente; el admin revisa y luego guarda
- evita duplicados al crear manualmente una ficha y luego categorizar su tag como anime, usando tag/titulo normalizados

`/biblioteca-anime/terminados`:

- lista las fichas de anime con estado `Terminado`
- conserva el badge superior de estado en la card
- usa la misma metadata y deduplicacion de la biblioteca de anime

`/spacedrum`:

- carga una ficha del manga desde `data/spacedrum.json`
- muestra portada, imagen hero, descripción, metadata y links externos
- incluye un lector vertical por capítulos
- está preparado para datos de prueba y para reemplazar imágenes/metadata por contenido real
- solo se muestra si `NEXT_PUBLIC_ENABLE_SPACEDRUM=true`; si no, la ruta devuelve 404 y no aparece en el menú

Menu lateral y footer:

- el brand del menu lateral usa `public/brand/lolweapon-logo.png` y el texto `LOLWEAPON`
- los items principales del menu usan iconos de `lucide-react`
- las vistas principales muestran un footer persistente con el texto `Por fans para fans 💜 para Kala`
- el menu lateral incluye accesos externos a YouTube, X, Instagram, Patreon y SpaceDrum mediante `components/SocialLinks.js`

### Query params del rastreador

La ruta `/rastreador` acepta filtros iniciales en la URL:

```text
/rastreador?search=World%20Trigger
/rastreador?q=World%20Trigger
/rastreador?year=2026
/rastreador?month=04
/rastreador?status=Completo
/rastreador?tag=WorldTrigger
```

Tambien se pueden combinar:

```text
/rastreador?search=anime&year=2026&month=04&status=Completo&tag=WorldTrigger
```

Estos parametros se aplican en cliente al cargar la pagina.

### Query params del detalle de resubido

La ruta `/rastreador/[id]` acepta:

```text
/rastreador/new_123?parte=2
```

`parte` selecciona la parte activa del player OK.RU. Si no existe o está fuera de rango, la app usa la parte guardada en `localStorage` para ese resubido o vuelve a la parte 1.

### Descarga local con Streamlink

En `/rastreador/[id]`, cuando existe una parte reproducible de `OK.RU`, debajo del player se muestra el boton rojo `Descargar en caso de fallar`.

La app no descarga videos en el servidor ni en el navegador. El modal solo prepara un comando para que el usuario lo ejecute localmente en su computador.

El comando generado usa esta forma:

```bash
streamlink "https://ok.ru/video/123456789" best -o "titulo-del-resubido-parte-1.mp4"
```

Dependencias recomendadas:

- `Streamlink`: necesario para resolver y descargar el stream de OK.RU.
- `FFmpeg`: puede ser necesario para guardar o unir correctamente algunos streams.

Links mostrados en el modal:

- Guia oficial de Streamlink: `https://streamlink.github.io/install.html`
- Releases de Streamlink: `https://github.com/streamlink/streamlink/releases`
- Homebrew para macOS: `https://brew.sh/`
- Descargas oficiales de FFmpeg: `https://ffmpeg.org/download.html`

El modal organiza la ayuda en cuatro pasos:

1. Instalar Streamlink.

   - Windows: usar el instalador oficial desde Releases de Streamlink.
   - macOS: instalar Homebrew y ejecutar `brew install streamlink`.
   - Linux: revisar la guia oficial para la distribucion usada.

2. Instalar FFmpeg si Streamlink lo necesita.

   - Windows: usar una build enlazada en Windows EXE Files desde la pagina oficial o ejecutar `winget install Gyan.FFmpeg`.
   - macOS: ejecutar `brew install ffmpeg`.
   - Linux: usar el gestor de paquetes de la distro, por ejemplo `sudo apt install ffmpeg`, `sudo dnf install ffmpeg` o `sudo pacman -S ffmpeg`.

3. Abrir una terminal.

   - Windows: PowerShell o CMD.
   - macOS: Terminal.
   - Linux: Terminal.

4. Copiar y ejecutar el comando de la parte activa.

Notas de uso:

- el archivo se guarda en la carpeta actual de la terminal
- para guardar en otra carpeta, se debe cambiar el valor despues de `-o`
- ejemplo macOS/Linux: `-o "~/Downloads/video.mp4"`
- ejemplo Windows: `-o "%USERPROFILE%\Downloads\video.mp4"`
- se puede verificar la instalacion con `streamlink --version` y `ffmpeg -version`
- si el comando no se reconoce, se recomienda cerrar y volver a abrir la terminal
- si falla al guardar o unir el archivo, instala FFmpeg y vuelve a intentar
- mientras el modal esta abierto, `Esc` lo cierra y los atajos globales del player quedan pausados

### Panel admin

El admin permite:

- crear un nuevo directo
- editar uno existente
- borrar registros
- subir miniaturas
- editar tags mediante un input tipo chips
- validar campos antes de guardar
- crear categorias personalizadas para tags
- mover tags entre categorias desde un modal amplio
- crear o actualizar manualmente un card desde el directo actual de Twitch
- registrar la suscripción EventSub para creación automática al iniciar directo

El acceso admin:

- se hace desde `/login`
- crea una cookie de sesión cuando la contraseña es correcta
- se valida de nuevo en cada endpoint protegido

## Persistencia de datos

El rastreador de directos puede usar dos archivos:

```text
data/data.json
data/data.local.json
```

Comportamiento:

- si existe `data/data.local.json`, la app lee y escribe ahí
- si no existe, la app usa `data/data.json`

La resolución de lectura y escritura vive en `lib/data.js`.

Al leer y guardar, el proyecto normaliza los datos con `lib/lives.js` para tolerar:

- campos faltantes
- arrays invalidos
- links vacios
- registros incompletos o heredados del archivo historico

La Biblioteca de anime usa:

```text
data/anime-metadata.json
data/anime-metadata.local.json
```

Comportamiento:

- si existe `data/anime-metadata.local.json`, la app lee y escribe ahí
- si no existe, la app usa `data/anime-metadata.json`
- `GET /api/anime-library` devuelve la biblioteca armada desde metadata, tags anime y registros del rastreador
- `POST /api/anime-library` esta protegido y permite crear o actualizar fichas
- `POST /api/anime-library/anilist` esta protegido y consulta AniList para rellenar campos del formulario
- la metadata creada manualmente puede existir antes de que exista un tag del rastreador
- si luego se crea un tag y se categoriza como `Anime`, la biblioteca deduplica por tag/titulo normalizado para evitar cards duplicadas

La resolución de lectura, escritura, cruce con tags y deduplicación vive en `lib/animeLibrary.js`.

La pagina `SpaceDrum` usa:

```text
data/spacedrum.json
data/spacedrum.local.json
```

Comportamiento:

- si existe `data/spacedrum.local.json`, la app lee ahí
- si no existe, la app usa `data/spacedrum.json`
- por ahora es una sección de lectura pública con data de prueba
- en producción se recomienda mantener `NEXT_PUBLIC_ENABLE_SPACEDRUM=false` hasta publicar el contenido real

La resolución de lectura y normalización vive en `lib/spacedrum.js`.

Las categorias personalizadas de tags y los movimientos manuales entre categorias se guardan en:

```text
data/tag-settings.json
data/tag-settings.local.json
```

Comportamiento:

- si existe `data/tag-settings.local.json`, la app lee y escribe ahí
- si no existe, la app usa `data/tag-settings.json`
- `GET /api/tags` es publico para que todos los usuarios vean la misma organizacion
- `POST /api/tags` esta protegido y solo permite cambios con sesion admin

La resolución de lectura, escritura y normalización vive en `lib/tagSettings.js`.

## Formato esperado del dataset

Cada registro del rastreador sigue esta forma:

```json
{
  "id": "2026_1_0",
  "title": "Titulo del directo",
  "year": "2026",
  "date": "03/01/2026",
  "status": "Completo",
  "tags": ["ReaccionVideos", "Minecraft"],
  "links": {
    "telegram": ["https://t.me/..."],
    "okru": ["https://ok.ru/..."],
    "piero": [],
    "patreon": []
  },
  "image": "/imagenes/ejemplo.jpg",
  "additional_info": "Texto opcional"
}
```

### Reglas practicas

- `date` usa formato `DD/MM/YYYY`
- `year` se guarda como string
- `tags` debe ser un array de strings
- `links` contiene arrays por plataforma
- los links de `okru` deben usar idealmente `https://ok.ru/video/<id>` o `https://ok.ru/videoembed/<id>` para que el player pueda crear el iframe
- si hay varios links `okru`, se interpretan como partes en el orden del array
- los links de `telegram` se listan como enlaces externos y no se embeben
- `image` puede estar vacio
- `additional_info` es opcional

Cada registro de `Viendo` sigue esta forma:

```json
{
  "id": "shoujo-ramune",
  "name": "Shoujo Ramune",
  "current_episode": "0",
  "purchased": "ENTERA",
  "image": "/imagenes/shoujo-ramune.png",
  "tracker_url": "/rastreador?tag=ShoujoRamune"
}
```

### Reglas practicas para animes

- `name` es obligatorio
- `current_episode` puede ser numero o string
- `purchased` puede ser un numero o `ENTERA`
- `image` puede apuntar a una imagen versionada en `public/imagenes`
- `tracker_url` es opcional; si no existe, el boton `Ver resubidos` usa `/rastreador?search=<nombre-del-anime>`

Cada ficha de `data/anime-metadata.json` usa como clave el tag normalizado y sigue esta forma:

```json
{
  "worldtrigger": {
    "tag": "WorldTrigger",
    "title": "World Trigger",
    "titleEs": "",
    "image": "/imagenes/world-trigger.jpg",
    "description": "Sinopsis original.",
    "descriptionEs": "",
    "provider": "anilist",
    "providerId": 20729,
    "providerUrl": "https://anilist.co/anime/20729",
    "trackerUrl": "/rastreador?tag=WorldTrigger",
    "year": 2014,
    "episodes": 73,
    "currentEpisode": "71",
    "purchased": "0",
    "format": "TV",
    "status": "FINISHED",
    "watchStatus": "watching",
    "libraryEnabled": true
  }
}
```

### Reglas practicas para la Biblioteca de anime

- `tag` conecta la ficha con los tags del rastreador
- si `trackerUrl` está vacio, se usa `/rastreador?tag=<tag>`
- `currentEpisode` indica el capitulo actual visto
- `episodes` indica el total de episodios y se usa junto a `currentEpisode` para la barra de progreso
- `purchased` puede ser `0`, un numero de capitulos comprados o `ENTERA`
- `watchStatus` controla en que pagina aparece:
  - `watching`: En seguimiento
  - `purchased`: En seguimiento; se considera temporada entera
  - `completed`: Terminados
  - `paused` o `pending`: estados disponibles para administración futura
- `libraryEnabled=false` oculta la ficha de la biblioteca
- las fichas creadas desde la web se guardan por `POST /api/anime-library`
- el boton `Completar desde AniList` solo rellena el formulario; no guarda cambios hasta presionar `Guardar`

El archivo `data/spacedrum.json` sigue esta forma:

```json
{
  "title": "SpaceDrum",
  "subtitle": "Manga de ciencia ficción musical",
  "status": "Demo",
  "coverImage": "https://placehold.co/900x1300/111827/f8fafc.png?text=SpaceDrum",
  "heroImage": "https://placehold.co/1600x900/0f172a/f8fafc.png?text=SpaceDrum+Preview",
  "description": "Descripción corta del manga.",
  "meta": [
    { "label": "Género", "value": "Sci-fi / Música" }
  ],
  "links": [
    { "label": "Sitio actual", "url": "https://www.mangaspacedrum.com/" }
  ],
  "chapters": [
    {
      "id": "capitulo-01",
      "title": "Capítulo 01",
      "releaseDate": "2026-01-12",
      "summary": "Resumen del capítulo.",
      "pages": [
        {
          "image": "https://placehold.co/1000x1500/111827/f8fafc.png?text=SpaceDrum+01-01",
          "alt": "Página 1"
        }
      ]
    }
  ]
}
```

## Tags y categorias

El panel de tags agrupa automaticamente los tags del rastreador con reglas en `lib/tags.js` y ajustes persistidos en `data/tag-settings.json`.

Categorias actuales:

- `Anime`
- `Juegos`
- `Tiers`
- `Charlas`
- `Peliculas`
- `Otros`

La clasificacion usa:

- coincidencias exactas para tags concretos
- keywords parciales para familias de tags
- categorias personalizadas creadas por admins
- overrides manuales en `data/tag-settings.json` cuando un admin mueve un tag desde el panel

Desde el panel de tags:

- cualquier usuario puede ver las categorias y filtrar por tag
- solo admins ven los controles para crear categorias o mover tags
- al crear una categoria se pide `Nombre` e `Icono`
- `Icono` espera un valor corto, normalmente un emoji como `🎭`, `🎵`, `📺` o `🔥`
- si se deja el icono vacio, se usa `🏷️`
- los cambios admin se guardan vía `POST /api/tags` y quedan visibles para todos los usuarios

Si muchos tags caen en `Otros`, hay dos opciones:

- mover esos tags desde el panel admin hacia una categoria existente o personalizada
- agregar keywords o coincidencias exactas en `lib/tags.js` si quieres que la clasificacion automatica lo haga sin overrides manuales

## API interna

### `POST /api/login`

Recibe:

```json
{ "password": "..." }
```

Respuesta exitosa:

- crea la cookie de sesión
- devuelve `success: true`

### `POST /api/logout`

- elimina la cookie de sesión

### `GET /api/lives`

- devuelve el dataset normalizado

### `GET /api/anime-library`

- devuelve la Biblioteca de anime armada desde `data/anime-metadata.json`, tags categorizados como anime y registros del rastreador
- incluye fichas sin resubidos si están habilitadas en metadata
- deduplica entradas manuales y entradas provenientes de tags por tag/titulo normalizado

### `POST /api/anime-library`

Endpoint protegido.

Acciones soportadas:

- `upsert`
- `update`

Ejemplo:

```json
{
  "action": "upsert",
  "key": "worldtrigger",
  "anime": {
    "tag": "WorldTrigger",
    "title": "World Trigger",
    "currentEpisode": "71",
    "purchased": "0",
    "watchStatus": "watching",
    "libraryEnabled": true
  }
}
```

### `POST /api/anime-library/anilist`

Endpoint protegido.

- consulta AniList por titulo o tag
- devuelve metadata para rellenar el formulario de la Biblioteca de anime
- no escribe archivos por si solo

Ejemplo:

```json
{ "search": "World Trigger" }
```

### `GET /api/tags`

- devuelve categorias personalizadas y movimientos manuales de tags
- es publico para que todos los usuarios vean la misma agrupacion

Respuesta:

```json
{
  "success": true,
  "categories": [
    {
      "key": "custom-reacciones",
      "label": "Reacciones",
      "icon": "🎭",
      "keywords": [],
      "custom": true
    }
  ],
  "overrides": {
    "worldtrigger": "anime"
  }
}
```

### `POST /api/tags`

Endpoint protegido.

- guarda categorias personalizadas
- guarda overrides manuales de tags
- normaliza los datos antes de escribir `data/tag-settings.json` o `data/tag-settings.local.json`

Ejemplo:

```json
{
  "categories": [
    {
      "key": "custom-reacciones",
      "label": "Reacciones",
      "icon": "🎭",
      "keywords": [],
      "custom": true
    }
  ],
  "overrides": {
    "reaccionvideos": "custom-reacciones"
  }
}
```

### `POST /api/update`

Endpoint protegido.

Acciones soportadas:

- `replace`
- `upsert`
- `delete`

Ejemplo `upsert`:

```json
{
  "action": "upsert",
  "live": {
    "id": "new_123",
    "title": "Nuevo directo"
  }
}
```

### `POST /api/upload`

Endpoint protegido.

- recibe `multipart/form-data`
- guarda archivos en `UPLOAD_DIR`, por defecto `public/imagenes`
- devuelve una ruta publica servida por la app, por ejemplo `/imagenes/archivo.png`

### `GET /imagenes/[filename]`

- sirve las imagenes subidas desde `UPLOAD_DIR`
- requiere que el servidor de produccion tenga almacenamiento persistente
- funciona como respaldo cuando el archivo existe en el servidor pero no fue servido como asset estatico

### `GET /api/twitch/status`

- devuelve el estado online/offline del canal
- devuelve perfil del broadcaster
- devuelve metadata actual del canal, incluyendo titulo y categoria aunque este offline
- devuelve metadata de la categoria cuando Twitch entrega `game_id`

### `POST /api/twitch/archive`

Endpoint protegido.

- consulta el directo actual en Twitch
- si el canal esta online, crea o actualiza un registro en el rastreador
- si el canal esta offline, devuelve `404`
- sirve como acción manual de recuperación si EventSub no fue registrado o falló

### `POST /api/twitch/eventsub`

Endpoint público para Twitch EventSub.

- valida la firma HMAC de Twitch con `TWITCH_EVENTSUB_SECRET`
- responde el challenge de verificación
- procesa eventos `stream.online`
- crea o actualiza un registro con metadata disponible de Twitch

Callback sugerido para EventSub:

```text
https://tu-dominio.com/api/twitch/eventsub
```

### `POST /api/twitch/eventsub/subscribe`

Endpoint protegido por sesión admin para registrar la suscripción `stream.online` en Twitch.

Requisitos:

- iniciar sesión como admin en la web
- configurar `TWITCH_CLIENT_ID`
- configurar `TWITCH_CLIENT_SECRET`
- configurar `TWITCH_BROADCASTER_LOGIN`
- configurar `TWITCH_EVENTSUB_SECRET`
- configurar `TWITCH_EVENTSUB_CALLBACK_URL`

Cuando se crea un registro automático:

- `title`: título actual del directo en Twitch
- `date` y `year`: fecha del inicio
- `status`: `En directo`
- `tags`: `Twitch` y la categoría si existe
- `image`: thumbnail de Twitch
- `additional_info`: URL del canal y datos disponibles

### `GET /api/youtube/videos`

- devuelve hasta 10 videos recientes del canal configurado
- usa `YOUTUBE_UPLOADS_PLAYLIST_ID` si existe
- si no existe, intenta resolver la playlist de subidas desde `YOUTUBE_CHANNEL_ID`

## Imagenes y archivos versionados

Las imagenes base usadas por la Biblioteca de anime pueden vivir en:

```text
public/imagenes/
```

Si quieres permitir solo ciertas imagenes en Git, usa una allowlist en `.gitignore`:

```gitignore
public/imagenes/*
!public/imagenes/
!public/imagenes/imagen-permitida.png
```

Notas:

- las imagenes ya versionadas deben quedar como excepciones con `!`
- las imagenes nuevas que no esten en la allowlist quedaran ignoradas
- si una imagen ignorada ya estaba trackeada, hay que quitarla del index con `git rm --cached`
- `/api/upload` guarda las subidas del admin en `UPLOAD_DIR`
- las subidas del admin quedan como datos de runtime y no deberian versionarse en Git
- si despliegas en un entorno serverless sin disco persistente, usa almacenamiento externo para las subidas

## Twitch EventSub

Para que Twitch cree registros automaticamente al iniciar directo:

1. Configura las variables `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_LOGIN`, `TWITCH_EVENTSUB_SECRET` y `TWITCH_EVENTSUB_CALLBACK_URL`.
2. En local, expone `http://localhost:3000` con una herramienta como `cloudflared` o `ngrok`.
3. Usa una callback HTTPS con puerto estandar:

```text
https://tu-dominio-publico.com/api/twitch/eventsub
```

4. Inicia sesion como admin.
5. En `/rastreador`, usa el boton admin `Registrar EventSub` o ejecuta el registro contra `POST /api/twitch/eventsub/subscribe`.

Twitch validara el webhook enviando un challenge al endpoint `/api/twitch/eventsub`.

Si el directo ya empezó y EventSub no creó el registro, usa el boton admin `Crear card desde Twitch` en `/rastreador`. Esa acción llama a `POST /api/twitch/archive` y crea o actualiza el card con la metadata actual.

## YouTube

La seccion de videos recientes de `/inicio` usa YouTube Data API.

Variables disponibles:

- `YOUTUBE_API_KEY`: API key de YouTube Data API.
- `YOUTUBE_CHANNEL_ID`: ID del canal.
- `YOUTUBE_CHANNEL_URL`: URL publica del canal para el boton `Ir al canal`.
- `YOUTUBE_UPLOADS_PLAYLIST_ID`: playlist de subidas. Es opcional, pero recomendable.

Si tienes la playlist de subidas, define `YOUTUBE_UPLOADS_PLAYLIST_ID` porque evita una consulta extra para resolverla desde el canal.

## Auth y seguridad

La autenticacion actual es simple y funcional para uso privado o de comunidad pequeña:

- login por contraseña
- cookie de sesión
- validación server-side en endpoints protegidos
- redirección automática fuera de `/login` si ya existe una sesión válida

Importante:

- no subas `.env`
- si una credencial de `.env` se comparte por error, rota el secreto o API key afectado antes de usarlo en produccion
- cambia siempre `ADMIN_PASSWORD` y `ADMIN_SESSION_TOKEN` antes de usarlo fuera de local
- restringe `YOUTUBE_API_KEY` en Google Cloud por API y, si aplica, por dominio o IP
- rota `TWITCH_CLIENT_SECRET` y `TWITCH_EVENTSUB_SECRET` si se exponen
- la persistencia actual escribe el archivo JSON completo en cada operación
- en plataformas serverless, los cambios escritos en archivos locales pueden no persistir; para produccion con escritura real conviene usar base de datos o storage persistente

## Flujo de trabajo recomendado

1. Haz backup de `data/data.json`, `data/anime-metadata.json` y `data/tag-settings.json`
2. Si no quieres tocar el dataset versionado, crea una copia local:

```bash
cp data/data.json data/data.local.json
cp data/anime-metadata.json data/anime-metadata.local.json
cp data/tag-settings.json data/tag-settings.local.json
```

3. Ejecuta `npm run dev`
4. Entra a `/login`
5. Crea o edita registros
6. Verifica cambios en la UI
7. Revisa el diff del archivo activo:

```text
data/data.local.json
data/data.json
data/anime-metadata.local.json
data/anime-metadata.json
data/tag-settings.local.json
data/tag-settings.json
```

## Notas sobre rendimiento

El proyecto ya incluye algunas mejoras para mantener la UI fluida con datasets grandes:

- preprocesado del texto de busqueda
- `useDeferredValue` para la busqueda
- `memo` en las cards
- carga incremental por scroll infinito sin virtualización agresiva

Se evito la virtualización del grid porque introducía problemas visuales con el layout de cards y parpadeo durante el scroll.

## Problemas comunes

### El login no funciona

Revisa:

- que `ADMIN_PASSWORD` exista en `.env`
- que reiniciaste `npm run dev` despues de cambiar variables de entorno

### No aparecen estilos

Revisa:

- que el servidor esté corriendo
- que `app/globals.css` esté siendo importado desde `app/layout.js`
- que el navegador no tenga una versión vieja en cache

Prueba un hard refresh:

- macOS: `Cmd + Shift + R`

### No se guardan cambios

Revisa:

- que la sesión admin siga vigente
- que exista y sea escribible el archivo de datos activo
- que no haya errores de validación en el modal
- que no estes esperando persistencia de archivos locales en un entorno serverless

### Las categorias de tags no cambian para otros usuarios

Revisa:

- que el cambio se haya hecho logueado como admin
- que `POST /api/tags` no devuelva `401`
- que `data/tag-settings.json` o `data/tag-settings.local.json` sea escribible
- que no estés probando contra otra instancia o entorno con otro archivo de datos
- que el usuario público haya refrescado la pagina para volver a consultar `/api/tags`

### No suben imágenes

Revisa:

- que estés logueado
- que el archivo sea válido
- que `UPLOAD_DIR` exista o pueda crearse automaticamente
- que exista permiso de escritura en `UPLOAD_DIR`
- que en producción `UPLOAD_DIR` apunte a un disco persistente

### Una imagen subida devuelve 404 en producción

Las imagenes en `public/imagenes` se sirven como archivos estaticos. Ese directorio sirve bien para imagenes que ya estaban presentes al construir la app, pero una subida hecha en runtime puede quedar guardada en un path distinto al que está sirviendo el proceso o proxy de producción.

Las nuevas subidas se guardan en `UPLOAD_DIR` y se sirven desde `/imagenes/[filename]`. Si el servidor se redeploya, reinicia o corre en un entorno serverless sin almacenamiento persistente, esas imagenes pueden desaparecer y volver a dar `404`.

### No aparece metadata de Twitch

Revisa:

- que `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` existan
- que `TWITCH_BROADCASTER_LOGIN` tenga el login correcto
- que reiniciaste el servidor despues de cambiar `.env`

### El player de Twitch no hace autoplay

La app intenta iniciar el stream automáticamente usando el SDK oficial de Twitch con el player muteado. Aun así, algunos navegadores, extensiones o preferencias del usuario pueden bloquear autoplay dentro de iframes.

Revisa:

- que el navegador no tenga autoplay bloqueado para el dominio
- que el player esté muteado al inicializar
- que el dominio actual esté llegando como `parent` válido para Twitch
- que no haya extensiones bloqueando scripts o iframes de Twitch

### Twitch no crea un card al iniciar directo

Revisa:

- que `TWITCH_EVENTSUB_CALLBACK_URL` apunte al dominio publico correcto y termine en `/api/twitch/eventsub`
- que la URL callback sea HTTPS y accesible desde internet
- que `TWITCH_EVENTSUB_SECRET` sea el mismo al registrar y al recibir eventos
- que hayas registrado la suscripción con el boton admin `Registrar EventSub`
- que el servidor pueda escribir en `data/data.json` o `data/data.local.json`
- si el directo ya está online, usa `Crear card desde Twitch` para crear el registro manualmente

### No aparecen videos de YouTube

Revisa:

- que `YOUTUBE_API_KEY` exista
- que `YOUTUBE_CHANNEL_ID` o `YOUTUBE_UPLOADS_PLAYLIST_ID` esten configurados
- que la API key tenga habilitada YouTube Data API v3

### El boton Ir al canal abre una URL incorrecta

Revisa:

- que `YOUTUBE_CHANNEL_URL` tenga la URL publica esperada
- si no usas `YOUTUBE_CHANNEL_URL`, que `YOUTUBE_CHANNEL_ID` corresponda al canal correcto

### Ver resubidos no filtra como esperabas

Revisa:

- que el anime tenga `tracker_url` configurado si necesita un filtro especifico
- que el tag o texto usado exista en los registros del rastreador
- que la URL use los parametros soportados: `search`, `q`, `year`, `status` o `tag`

### Un link OK.RU no aparece en el player

El detalle solo embebe links que permitan extraer un id de video con estas formas:

```text
https://ok.ru/video/123456789
https://ok.ru/videoembed/123456789
```

Revisa:

- que el link esté en `links.okru`
- que el path contenga `/video/` o `/videoembed/`
- que el video permita embed desde OK.RU
- que el navegador no bloquee iframes o contenido de terceros

Si no hay un OK.RU reproducible pero hay Telegram, la página muestra un acceso directo a Telegram.

### El detalle no vuelve al mismo lugar del rastreador

La restauración depende de `sessionStorage` y solo se guarda al entrar al detalle desde una card del rastreador.

Revisa:

- que hayas entrado desde una card, no pegando la URL manualmente
- que el navegador no bloquee `sessionStorage`
- que no hayas abierto el detalle en otra pestaña
- que el dataset no haya cambiado de forma que el card ya no exista con el mismo `id`

### La parte activa de OK.RU no se recuerda

El detalle guarda la última parte vista por resubido en `localStorage`.

Revisa:

- que el navegador no bloquee `localStorage`
- que el registro tenga un `id` estable
- que el link OK.RU sea reproducible

Si compartes una URL con `?parte=N`, ese valor tiene prioridad sobre lo guardado localmente.

## Desarrollo futuro sugerido

Ideas naturales para seguir mejorándolo:

- validación más estricta de URLs por plataforma
- auditoría o historial de cambios
- import/export de dataset desde panel admin
- estado visual de links reportados o rotos
- formulario propio para reportar links caidos en vez de `mailto`
- tests de interaccion para el player OK.RU y restauracion del rastreador
- confirmaciones más detalladas para cambios destructivos
- tests para `lib/lives.js`, `lib/data.js`, `lib/animeLibrary.js` y `lib/tagSettings.js`

## Licencia

MIT
