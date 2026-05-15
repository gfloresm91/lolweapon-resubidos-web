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
- iniciar sesion con usuario manual o Twitch OAuth
- registrar usuarios manuales desde `/registro`
- configurar perfil, email, contraseña y avatar personalizado
- administrar usuarios, roles y permisos por pantalla desde `/administracion`
- administrar los mantenedores de `Viendo` y `Terminados` desde `/administracion/biblioteca-anime`
- administrar categorias globales de tags desde la interfaz admin
- crear y editar fichas de anime con metadata de AniList bajo demanda
- guardar los cambios en JSON local o en Postgres normalizado, segun `DATA_SOURCE`
- subir miniaturas desde la interfaz admin

## Stack

- `Next.js` App Router
- `React 19`
- `Route Handlers` para la API
- `react-hook-form` + `zod` para validaciones del admin
- `lucide-react` para iconos de navegacion
- `sonner` para toasts
- `react-dropzone` para carga de avatar por drag and drop
- `Prisma` + `PostgreSQL` para persistencia normalizada
- modo JSON para desarrollo local, fallback y exportaciones

## Requisitos

- `Node.js 20+` recomendado
- `npm`
- `Docker` opcional, recomendado para levantar Postgres local o en el droplet

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
DATA_SOURCE=json
```

4. Para trabajar en modo JSON, coloca tus datasets base en:

```text
data/data.json
data/anime-metadata.json
data/tag-settings.json
data/spacedrum.json
```

Opcional, si quieres trabajar sin modificar los archivos versionados:

```bash
cp data/data.json data/data.local.json
cp data/anime-metadata.json data/anime-metadata.local.json
cp data/tag-settings.json data/tag-settings.local.json
cp data/spacedrum.json data/spacedrum.local.json
```

Si existe un archivo `.local.json`, la app lo usará en lugar del archivo base equivalente para leer y guardar cambios.

5. Para trabajar en modo Postgres local, levanta la base de datos e importa la data:

```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate:deploy
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
```

En este modo `.env` debe incluir `DATA_SOURCE=postgres` y `DATABASE_URL`.

6. Levanta el entorno de desarrollo:

```bash
npm run dev
```

7. Abre:

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
npm run audit:data
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run db:import:anime
npm run db:export:anime
npm run db:import:lives
npm run db:export:lives
npm run db:import:tags
npm run db:export:tags
npm run db:import:spacedrum
npm run db:export:spacedrum
npm run db:backup
npm run db:restore
npm run enrich:anime
```

Nota: en `Next.js 15`, `next lint` está deprecado. Si el proyecto no tiene una configuración ESLint creada, `npm run lint` puede abrir un asistente interactivo de configuración. Para verificación no interactiva, `npm run build` compila, valida tipos y recolecta las rutas.

`npm run audit:data` valida la fuente activa. Con `DATA_SOURCE=json` revisa archivos JSON; con `DATA_SOURCE=postgres` revisa la BD.

Los scripts `db:import:*` cargan datos desde JSON hacia Postgres. Los scripts `db:export:*` escriben archivos `.export.json` de seguridad y no sobreescriben los JSON fuente.

`npm run enrich:anime` consulta AniList para completar metadata faltante. En modo JSON actualiza el archivo activo; en modo Postgres actualiza la biblioteca en BD. Es una herramienta de mantenimiento masivo; para administración diaria se recomienda usar el botón `Completar desde AniList` dentro del modal de la Biblioteca de anime.

## Variables de entorno

El proyecto usa estas variables:

- `DATA_SOURCE`
  Fuente de datos activa. Usa `json` para archivos locales o `postgres` para Prisma/Postgres. Por defecto: `json`.
- `DATABASE_URL`
  URL de conexion de Prisma a Postgres. Requerida cuando `DATA_SOURCE=postgres`.
- `POSTGRES_DB`
  Nombre de la base usada por Docker Compose.
- `POSTGRES_USER`
  Usuario de Postgres usado por Docker Compose.
- `POSTGRES_PASSWORD`
  Password de Postgres usado por Docker Compose. Debe cambiarse en produccion.
- `POSTGRES_PORT`
  Puerto local donde Docker publica Postgres. Por defecto suele ser `5432`.
- `BACKUP_DIR`
  Carpeta donde `npm run db:backup` deja los dumps. Por defecto: `backups/postgres`.
- `BACKUP_FILE`
  Archivo `.dump` que `npm run db:restore` debe restaurar.
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
- `TWITCH_AUTH_REDIRECT_URI`
  Callback OAuth principal para login con Twitch. Si el request viene desde `RESUBIDOS_HOST` o `VIENDO_HOST`, la app usa ese host y `/api/auth/twitch/callback`; esto permite iniciar sesion desde ambos dominios QA/produccion. Registra todos esos callbacks en Twitch Developers.
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
  Los avatares personalizados se sirven desde `/imagenes/avatars/<archivo>` y se guardan bajo `UPLOAD_DIR/avatars`.
- `NEXT_PUBLIC_ENABLE_SPACEDRUM`
  Feature flag para mostrar la sección `/spacedrum` y su item de menú. Por defecto debe quedar en `false` hasta que la página esté lista para producción.

Notas:

- si no defines estas variables, el proyecto tiene valores por defecto pensados solo para entorno local
- no uses esos valores por defecto en produccion
- `.env` no debe versionarse; usa `.env.example` como plantilla

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
    register/route.js
    auth/
      twitch/
        start/route.js
        callback/route.js
    platform-users/route.js
    platform-roles/route.js
    profile/
      route.js
      avatar/route.js
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
    avatars/[filename]/route.js
  login/page.js
  registro/page.js
  perfil/page.js
  administracion/
    usuarios/page.js
    roles/page.js
    biblioteca-anime/
      viendo/page.js
      terminados/page.js
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
  MaintainerModal.js
  MaintainerStats.js
  MaintainerTable.js
  MaintainerToolbar.js
  AvatarUploader.js
  AccountMenu.js
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
  animeDbMapping.js
  animeLibrary.js
  auth.js
  serverAuth.js
  loginSecurity.js
  platformUserValidation.js
  data.js
  liveDbMapping.js
  lives.js
  prisma.js
  repositories/
    animeLibraryRepository.js
    liveRepository.js
    spaceDrumRepository.js
    platformUserRepository.js
  spacedrum.js
  tagSettings.js
  tags.js
  twitch.js
  twitchArchive.js
  youtube.js

data/
  data.json
  anime-metadata.json
  animes.json        # legacy/reference dataset, not used by the current UI
  spacedrum.json
  tag-settings.json

docs/
  postgres-migration.md
  release-and-production.md

prisma/
  schema.prisma
  migrations/

scripts/
  audit-data.mjs
  import-*.mjs
  export-*.mjs
  backup-postgres.sh
  restore-postgres.sh

public/
  brand/
    lolweapon-logo.png
  imagenes/

middleware.js
docker-compose.yml
docker-compose.prod.example.yml
prisma.config.ts
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
- mantiene el mismo shell visual de la app: menu lateral, topbar y acciones superiores
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

- carga fichas desde el repositorio activo: JSON o Postgres
- cruza esas fichas con los tags categorizados como `Anime`
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

- carga una ficha del manga desde el repositorio activo: JSON o Postgres
- muestra portada, imagen hero, descripción, metadata y links externos
- incluye un lector vertical por capítulos
- está preparado para datos de prueba y para reemplazar imágenes/metadata por contenido real
- solo se muestra si `NEXT_PUBLIC_ENABLE_SPACEDRUM=true`; si no, la ruta devuelve 404 y no aparece en el menú

Menu lateral y footer:

- el brand del menu lateral usa `public/brand/lolweapon-logo.png` y el texto `LOLWEAPON`
- los items principales del menu usan iconos de `lucide-react`
- Inicio y el detalle del rastreador mantienen un footer persistente de comunidad
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

### Autenticacion y administracion

La app soporta tres niveles de acceso:

- `Invitado`: usuario publico sin sesion. Sus permisos se administran desde el rol `Invitado`.
- usuario registrado manualmente: entra con usuario y contraseña desde `/login`.
- usuario externo: entra con Twitch OAuth desde `/login`; YouTube queda preparado para incorporarse mas adelante.

Rutas principales:

- `/login`: login manual, login Twitch y acceso a registro.
- `/registro`: alta manual de usuario. Por defecto asigna el rol `Publico`.
- `/perfil`: permite editar alias, email, avatar personalizado y contraseña.
- `/administracion/usuarios`: mantenedor de usuarios.
- `/administracion/roles`: mantenedor de roles y permisos.
- `/administracion/biblioteca-anime/viendo`: mantenedor administrativo de animes en seguimiento.
- `/administracion/biblioteca-anime/terminados`: mantenedor administrativo de animes terminados.

El login manual muestra mensajes genericos de credenciales incorrectas para no revelar si el usuario existe. Las validaciones de formularios se muestran bajo cada campo y se mantienen homologadas entre registro, perfil y mantenedores.

El perfil permite reemplazar el avatar con drag and drop o selector de archivos. La app valida extension/MIME, firma real del archivo y tamaño maximo de 2 MB. Los avatares personalizados se conservan aunque el usuario vuelva a iniciar sesion con Twitch.

El panel de contenido tambien permite:

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

El mantenedor de usuarios permite:

- crear usuarios manuales
- editar usuario, alias, email, avatar y rol
- cambiar contraseña desde una operacion separada
- activar o desactivar usuarios desde una operacion con confirmacion
- archivar usuarios con eliminacion logica mediante `deletedAt`
- buscar por ID, alias, usuario, email o rol
- filtrar por rol, estado y origen
- ordenar columnas y paginar resultados

Reglas protegidas:

- `Dios` es unico e inmutable: no se puede eliminar, desactivar ni cambiar contraseña.
- `Admin` no ve operaciones para el usuario `Dios`.
- `Invitado` no se puede eliminar ni cambiar de estado.

El mantenedor de roles permite:

- crear y editar roles temporales o permanentes
- activar/desactivar roles desde una operacion dedicada
- asignar permisos por pantalla y accion
- buscar por ID, codigo o nombre
- crear roles sin permisos, mostrando advertencia visual
- usar buscador interno dentro del modal de permisos

Los mantenedores administrativos de Biblioteca Anime permiten:

- crear fichas desde busqueda de AniList o de forma manual
- editar metadata, progreso, estado, imagen y URL de rastreador
- seleccionar o crear tags de resubidos
- generar automaticamente la URL del rastreador desde tag o titulo
- ocultar/mostrar fichas desde una operacion dedicada
- eliminar fichas con confirmacion
- filtrar, ordenar y paginar con la tabla estandarizada de mantenedores

Roles base actuales:

- `Dios`
- `Admin`
- `Moderador`
- `TW_Tier 1`
- `TW_Tier 2`
- `TW_Tier 3`
- `TW_VIP`
- `YT_Miembro`
- `Publico`
- `Invitado`

El acceso protegido:

- se hace desde `/login`
- crea una cookie de sesión cuando el login es correcto
- se valida de nuevo en cada endpoint protegido
- se controla por permisos (`users.read`, `roles.update`, `anime.tracking.view`, etc.) y por rol `Dios`
- separa permisos públicos de biblioteca (`Anime: Viendo`, `Anime: Terminados`) de permisos de mantenedores administrativos (`Administración: Viendo`, `Administración: Terminados`)
- los mantenedores administrativos de Viendo y Terminados requieren rol `Dios` o `Admin`, permiso del módulo administrativo y al menos una acción operativa sobre esa pantalla
- el menú de administración mantiene el orden estándar: Usuarios, Roles, Viendo y Terminados

## Persistencia de datos

La app tiene dos modos de persistencia controlados por `DATA_SOURCE`.

### Modo JSON

```env
DATA_SOURCE=json
```

Este modo usa archivos en `data/` y es util para desarrollo, respaldo y comparaciones.

Archivos base:

```text
data/data.json
data/anime-metadata.json
data/tag-settings.json
data/spacedrum.json
```

Archivos locales opcionales:

```text
data/data.local.json
data/anime-metadata.local.json
data/tag-settings.local.json
data/spacedrum.local.json
```

Si existe un `.local.json`, la app lo usa antes que el archivo base equivalente. Estos archivos locales estan ignorados por Git.

### Modo Postgres

```env
DATA_SOURCE=postgres
DATABASE_URL=postgresql://usuario:password@127.0.0.1:5432/lolweapon_resubidos
```

Este modo usa Prisma y el schema normalizado en `prisma/schema.prisma`.

Tablas principales:

- `Live`, `LiveStatus`, `LiveTag`, `LiveLink`, `LinkPlatform`
- `Anime`, `AnimeLibraryEntry`, `AnimeExternalReference`
- `AnimeFormat`, `AnimeReleaseStatus`, `AnimeWatchStatus`
- `Tag`, `TagCategory`
- `SpaceDrum`, `SpaceDrumMeta`, `SpaceDrumLink`, `SpaceDrumChapter`, `SpaceDrumPage`
- `PlatformUser`, `PlatformRole`, `PlatformPermission`, `PlatformRolePermission`
- `PlatformSession`, `LoginAttempt`

Los catalogos (`LiveStatus`, `AnimeWatchStatus`, `AnimeFormat`, etc.) evitan repetir strings sueltos y permiten compartir estados entre UI, API, importadores y exportadores.

### Repositorios

La UI no lee archivos o tablas directamente. Las rutas API pasan por repositorios que compactan JSON/Postgres al mismo contrato de datos que usan los componentes:

- `lib/repositories/liveRepository.js`
- `lib/repositories/animeLibraryRepository.js`
- `lib/repositories/spaceDrumRepository.js`
- `lib/tagSettings.js`

Esto permite cambiar entre JSON y Postgres sin modificar el frontend.

### Import/export

Los imports cargan JSON hacia Postgres:

```bash
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
```

Los exports escriben archivos de seguridad:

```bash
DATA_SOURCE=postgres npm run db:export:anime
DATA_SOURCE=postgres npm run db:export:lives
DATA_SOURCE=postgres npm run db:export:tags
DATA_SOURCE=postgres npm run db:export:spacedrum
```

Salidas esperadas:

```text
data/anime-metadata.export.json
data/data.export.json
data/tag-settings.export.json
data/spacedrum.export.json
```

Los `.export.json` tambien estan ignorados por Git.

Para el detalle operativo de migracion, despliegue y backups, revisa:

- `docs/postgres-migration.md`
- `docs/release-and-production.md`

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
- si `trackerUrl` está vacio, se genera una URL al rastreador con `/rastreador?tag=<tag>`; si no hay tag, se usa `/rastreador?search=<titulo>`
- `trackerUrl` permite reemplazar el enlace generado cuando se necesita un filtro especifico del rastreador
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
- en administracion, Viendo usa el modo `watching`/`purchased` y Terminados usa el modo `completed`

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

El panel de tags agrupa automaticamente los tags del rastreador con reglas en `lib/tags.js` y ajustes persistidos en la fuente activa.

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
- overrides manuales cuando un admin mueve un tag desde el panel

Desde el panel de tags:

- cualquier usuario puede ver las categorias y filtrar por tag
- solo admins ven los controles para crear categorias o mover tags
- al crear una categoria se pide `Nombre` e `Icono`
- `Icono` espera un valor corto, normalmente un emoji como `🎭`, `🎵`, `📺` o `🔥`
- si se deja el icono vacio, se usa `🏷️`
- los cambios admin se guardan vía `POST /api/tags` y quedan visibles para todos los usuarios
- en modo Postgres, categorias y overrides se guardan en `TagCategory` y `Tag`

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

- devuelve el dataset normalizado desde JSON o Postgres
- incluye el catalogo de estados disponible para el modal admin

### `GET /api/anime-library`

- devuelve la Biblioteca de anime armada desde la fuente activa, tags categorizados como anime y registros del rastreador
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

- consulta AniList por URL, titulo o tag
- si el formulario trae URL de AniList, esa URL tiene prioridad sobre titulo y tag
- devuelve metadata para rellenar el formulario de la Biblioteca de anime
- no persiste cambios por si solo

Ejemplo:

```json
{ "providerUrl": "https://anilist.co/anime/20729/World-Trigger/" }
```

### `GET /api/tags`

- devuelve categorias personalizadas y movimientos manuales de tags
- en modo Postgres, devuelve el estado compacto de `TagCategory` y `Tag`
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
- normaliza los datos antes de escribir JSON o Postgres
- mantiene los tags de anime existentes aunque no tengan registros del rastreador

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
- `status`: `En directo`, tomado del catalogo de estados en la fuente activa
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
- no subas `docker-compose.prod.yml`, dumps de `backups/`, archivos `.local.json` o `.export.json`
- si una credencial de `.env` se comparte por error, rota el secreto o API key afectado antes de usarlo en produccion
- restringe `YOUTUBE_API_KEY` en Google Cloud por API y, si aplica, por dominio o IP
- rota `TWITCH_CLIENT_SECRET` y `TWITCH_EVENTSUB_SECRET` si se exponen
- en modo JSON se escribe el archivo completo en cada operación
- para produccion con escritura real se recomienda `DATA_SOURCE=postgres`
- Postgres debe quedar publicado solo en `127.0.0.1` o en una red privada, nunca abierto a internet

## Flujo de trabajo recomendado

### Desarrollo en JSON

1. Haz backup de `data/data.json`, `data/anime-metadata.json`, `data/tag-settings.json` y `data/spacedrum.json`.
2. Crea copias locales si no quieres tocar el dataset versionado:

```bash
cp data/data.json data/data.local.json
cp data/anime-metadata.json data/anime-metadata.local.json
cp data/tag-settings.json data/tag-settings.local.json
cp data/spacedrum.json data/spacedrum.local.json
```

3. Usa `DATA_SOURCE=json`.
4. Ejecuta `npm run dev`.
5. Entra a `/login`.
6. Crea o edita registros.
7. Verifica cambios en la UI.
8. Revisa el diff del archivo activo.

### Desarrollo en Postgres

1. Levanta Postgres:

```bash
docker compose up -d postgres
```

2. Ejecuta migraciones e imports:

```bash
npm run db:generate
npm run db:migrate:deploy
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
```

3. Usa `DATA_SOURCE=postgres`.
4. Ejecuta `npm run dev`.
5. Entra a `/login`.
6. Crea o edita registros.
7. Verifica cambios en la UI y, si hace falta, en `npm run db:studio`.

### Produccion con systemd y Postgres Docker

El despliegue recomendado mantiene Next.js bajo systemd y ejecuta solo Postgres en Docker.

1. Copia la plantilla:

```bash
cp docker-compose.prod.example.yml docker-compose.prod.yml
```

2. Configura el `.env` existente del servidor con `DATA_SOURCE=postgres`, `DATABASE_URL` y las variables `POSTGRES_*`.
3. Levanta Postgres:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
```

4. Aplica migraciones e importa data:

```bash
DATA_SOURCE=postgres npm run db:migrate:deploy
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
```

5. Valida:

```bash
DATA_SOURCE=postgres npm run audit:data
DATA_SOURCE=postgres npm run build
```

6. Reinicia el servicio systemd de la app.

La guia completa esta en `docs/postgres-migration.md`.

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

- que el usuario exista, esté activo y tenga contraseña configurada
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
- que no haya errores de validación en el modal
- que `DATA_SOURCE` apunte a la fuente donde estas revisando los cambios
- en modo JSON, que exista y sea escribible el archivo activo
- en modo Postgres, que `DATABASE_URL` apunte a la BD correcta y que las migraciones estén aplicadas

### Las categorias de tags no cambian para otros usuarios

Revisa:

- que el cambio se haya hecho logueado como admin
- que `POST /api/tags` no devuelva `401`
- que `DATA_SOURCE` sea el mismo en la instancia donde estas probando
- en modo JSON, que `data/tag-settings.json` o `data/tag-settings.local.json` sea escribible
- en modo Postgres, que `Tag` y `TagCategory` se estén leyendo desde la misma BD
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
- que el servidor pueda escribir en la fuente activa
- en modo Postgres, que el estado `En directo` exista en `LiveStatus`
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

- que el anime tenga `trackerUrl` configurado si necesita un filtro especifico
- que el tag o texto usado exista en los registros del rastreador
- que la URL use `/rastreador` o una URL `http/https` valida
- que los parametros internos soportados sean `tag`, `search`, `q`, `year`, `month` o `status`

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
