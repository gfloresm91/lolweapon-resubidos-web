# Lolweapon Resubidos Web

Archivo historico de directos y VODs migrado a Next.js full stack.

La aplicacion permite:

- mostrar un inicio con player/chat de Twitch, metadata del canal, ultimos directos y ultimos videos de YouTube
- explorar el archivo historico por busqueda, año, estado y tags
- seguir la lista de animes en la pagina `Viendo`
- visualizar enlaces por plataforma (`OK.RU`, `Telegram`, `Patreon`)
- abrir el rastreador desde animes con filtros preaplicados
- administrar el archivo desde una interfaz protegida por login
- administrar categorias globales de tags desde la interfaz admin
- guardar los cambios sobre un dataset base o sobre un dataset local opcional
- subir miniaturas a `public/imagenes`

## Stack

- `Next.js` App Router
- `React 19`
- `Route Handlers` para la API
- `react-hook-form` + `zod` para validaciones del admin
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
data/animes.json
```

Opcional, si quieres trabajar sin modificar los archivos versionados:

```bash
cp data/data.json data/data.local.json
cp data/animes.json data/animes.local.json
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
```

## Variables de entorno

El proyecto usa estas variables:

- `ADMIN_PASSWORD`
  Contraseña del panel admin.
- `ADMIN_SESSION_TOKEN`
  Token secreto usado para validar la cookie de sesión.
- `RESUBIDOS_HOST`
  Host que debe cargar `/rastreador` cuando se visita la raíz. Ejemplo QA: `resubidos-qa.lolweapon.com`.
- `VIENDO_HOST`
  Host que debe cargar `/viendo` cuando se visita la raíz. Ejemplo QA: `viendo-qa.lolweapon.com`.
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

Notas:

- si no defines estas variables, el proyecto tiene valores por defecto pensados solo para entorno local
- no uses esos valores por defecto en produccion

## Estructura del proyecto

```text
app/
  api/
    animes/route.js
    lives/route.js
    login/route.js
    logout/route.js
    tags/route.js
    twitch/
      eventsub/
        route.js
        subscribe/route.js
      status/route.js
    update/route.js
    upload/route.js
    youtube/
      videos/route.js
  inicio/page.js
  login/page.js
  layout.js
  page.js
  rastreador/page.js
  viendo/page.js
  globals.css

components/
  AdminModal.js
  ConfirmModal.js
  FiltersBar.js
  HomeDashboard.js
  HomePage.js
  LiveCard.js
  LoreModal.js
  StatsBar.js
  TagPanel.js
  TagsInput.js
  WatchingPage.js

lib/
  animeData.js
  animes.js
  auth.js
  data.js
  lives.js
  tagSettings.js
  tags.js
  twitch.js
  twitchArchive.js
  youtube.js

data/
  data.json
  data.local.json
  animes.json
  animes.local.json
  tag-settings.json
  tag-settings.local.json

public/
  imagenes/

middleware.js
```

## Como funciona la app

### Rutas y dominios

Rutas internas:

- `/inicio`: hub principal con Twitch, últimos directos y YouTube.
- `/rastreador`: archivo de directos/resubidos.
- `/viendo`: seguimiento de animes.

En producción, el middleware reescribe la raíz según el dominio:

- `${RESUBIDOS_HOST}/` carga `/rastreador`.
- `${VIENDO_HOST}/` carga `/viendo`.

### Frontend publico

`/inicio`:

- muestra el player y chat de Twitch
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
- aplica filtros por texto, año, estado y tag
- puede recibir filtros iniciales por query params
- muestra estadisticas generales
- renderiza cards con informacion, tags y links
- agrupa tags en categorias automaticas como Anime, Juegos, Tiers, Charlas, Peliculas y Otros
- carga categorias personalizadas y movimientos manuales desde `/api/tags`
- usa scroll infinito ligero para cargar resultados por bloques sin romper el layout

`/viendo`:

- carga el dataset de animes
- muestra estadisticas de animes, temporadas enteras, capitulos comprados y pendientes
- permite buscar y filtrar por estado de compra
- muestra un boton `Ver resubidos` por anime que abre el rastreador en una pestaña nueva
- si hay sesion admin, permite crear, editar, borrar y subir poster de animes
- si hay sesion admin, permite guardar una URL personalizada hacia el rastreador por anime

Footer:

- las vistas principales muestran un footer persistente con el texto `Por fans para fans 💜 para Kala`

### Query params del rastreador

La ruta `/rastreador` acepta filtros iniciales en la URL:

```text
/rastreador?search=World%20Trigger
/rastreador?q=World%20Trigger
/rastreador?year=2026
/rastreador?status=Completo
/rastreador?tag=WorldTrigger
```

Tambien se pueden combinar:

```text
/rastreador?search=anime&year=2026&status=Completo&tag=WorldTrigger
```

Estos parametros se aplican en cliente al cargar la pagina.

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

La pagina `Viendo` usa la misma estrategia con:

```text
data/animes.json
data/animes.local.json
```

Comportamiento:

- si existe `data/animes.local.json`, la app lee y escribe ahí
- si no existe, la app usa `data/animes.json`

La resolución de lectura y escritura vive en `lib/animeData.js`.

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

### `GET /api/animes`

- devuelve el dataset normalizado de la pagina `Viendo`

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

### `POST /api/animes`

Endpoint protegido.

Acciones soportadas:

- `replace`
- `upsert`
- `delete`

Ejemplo `upsert`:

```json
{
  "action": "upsert",
  "anime": {
    "id": "anime_123",
    "name": "Nuevo anime"
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
- guarda archivos en `public/imagenes`
- devuelve la ruta publica resultante

### `GET /api/twitch/status`

- devuelve el estado online/offline del canal
- devuelve perfil del broadcaster
- devuelve metadata actual del canal, incluyendo titulo y categoria aunque este offline
- devuelve metadata de la categoria cuando Twitch entrega `game_id`

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

Las imagenes base usadas por `data/animes.json` pueden vivir en:

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
- actualmente `/api/upload` guarda en `public/imagenes`; si usas allowlist, agrega una excepcion para cada imagen que quieras versionar
- si prefieres que las subidas del admin no aparezcan en Git, mueve ese flujo a `public/imagenes/uploads/` o `public/imagenes/tmp/`

## Twitch EventSub

Para que Twitch cree registros automaticamente al iniciar directo:

1. Configura las variables `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_LOGIN`, `TWITCH_EVENTSUB_SECRET` y `TWITCH_EVENTSUB_CALLBACK_URL`.
2. En local, expone `http://localhost:3000` con una herramienta como `cloudflared` o `ngrok`.
3. Usa una callback HTTPS con puerto estandar:

```text
https://tu-dominio-publico.com/api/twitch/eventsub
```

4. Inicia sesion como admin.
5. Ejecuta el registro de la suscripcion contra `POST /api/twitch/eventsub/subscribe`.

Twitch validara el webhook enviando un challenge al endpoint `/api/twitch/eventsub`.

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

1. Haz backup de `data/data.json`, `data/animes.json` y `data/tag-settings.json`
2. Si no quieres tocar el dataset versionado, crea una copia local:

```bash
cp data/data.json data/data.local.json
cp data/animes.json data/animes.local.json
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
data/animes.local.json
data/animes.json
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
- que exista permiso de escritura en `public/imagenes`
- que el `.gitignore` no este ocultando una imagen que si querias versionar

### No aparece metadata de Twitch

Revisa:

- que `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` existan
- que `TWITCH_BROADCASTER_LOGIN` tenga el login correcto
- que reiniciaste el servidor despues de cambiar `.env`

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

## Desarrollo futuro sugerido

Ideas naturales para seguir mejorándolo:

- validación más estricta de URLs por plataforma
- auditoría o historial de cambios
- import/export de dataset desde panel admin
- confirmaciones más detalladas para cambios destructivos
- tests para `lib/lives.js`, `lib/data.js`, `lib/animes.js`, `lib/animeData.js` y `lib/tagSettings.js`

## Licencia

MIT
