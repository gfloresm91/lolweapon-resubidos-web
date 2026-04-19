# Lolweapon Resubidos Web

Archivo historico de directos y VODs migrado a Next.js full stack.

La aplicacion permite:

- explorar el archivo historico por busqueda, año, estado y tags
- visualizar enlaces por plataforma (`OK.RU`, `Telegram`, `Patreon`)
- administrar el archivo desde una interfaz protegida por login
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

4. Coloca tu dataset real en:

```text
data/data.json
```

Opcional, si quieres trabajar sin modificar el archivo versionado:

```bash
cp data/data.json data/data.local.json
```

Si `data/data.local.json` existe, la app lo usará en lugar de `data/data.json` para leer y guardar cambios.

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

Notas:

- si no defines estas variables, el proyecto tiene valores por defecto pensados solo para entorno local
- no uses esos valores por defecto en produccion

## Estructura del proyecto

```text
app/
  api/
    lives/route.js
    login/route.js
    logout/route.js
    update/route.js
    upload/route.js
  login/page.js
  page.js
  layout.js
  globals.css

components/
  AdminModal.js
  ConfirmModal.js
  FiltersBar.js
  HomePage.js
  LiveCard.js
  LoreModal.js
  StatsBar.js
  TagPanel.js
  TagsInput.js

lib/
  auth.js
  data.js
  lives.js
  tags.js

data/
  data.json

public/
  imagenes/
```

## Como funciona la app

### Frontend publico

La portada:

- carga el dataset inicial desde servidor
- aplica filtros por texto, año, estado y tag
- muestra estadisticas generales
- renderiza cards con informacion, tags y links
- usa scroll infinito ligero para cargar resultados por bloques sin romper el layout

### Panel admin

El admin permite:

- crear un nuevo directo
- editar uno existente
- borrar registros
- subir miniaturas
- editar tags mediante un input tipo chips
- validar campos antes de guardar

El acceso admin:

- se hace desde `/login`
- crea una cookie de sesión cuando la contraseña es correcta
- se valida de nuevo en cada endpoint protegido

## Persistencia de datos

La app puede usar dos archivos:

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

## Formato esperado del dataset

Cada registro sigue esta forma:

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

## Auth y seguridad

La autenticacion actual es simple y funcional para uso privado o de comunidad pequeña:

- login por contraseña
- cookie de sesión
- validación server-side en endpoints protegidos
- redirección automática fuera de `/login` si ya existe una sesión válida

Importante:

- no subas `.env`
- cambia siempre `ADMIN_PASSWORD` y `ADMIN_SESSION_TOKEN` antes de usarlo fuera de local
- la persistencia actual escribe el archivo JSON completo en cada operación

## Flujo de trabajo recomendado

1. Haz backup de `data/data.json`
2. Si no quieres tocar el dataset versionado, crea una copia local:

```bash
cp data/data.json data/data.local.json
```

3. Ejecuta `npm run dev`
4. Entra a `/login`
5. Crea o edita registros
6. Verifica cambios en la UI
7. Revisa el diff de `data/data.local.json` o `data/data.json`, según el archivo activo

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

### No suben imágenes

Revisa:

- que estés logueado
- que el archivo sea válido
- que exista permiso de escritura en `public/imagenes`

## Desarrollo futuro sugerido

Ideas naturales para seguir mejorándolo:

- validación más estricta de URLs por plataforma
- auditoría o historial de cambios
- import/export de dataset desde panel admin
- confirmaciones más detalladas para cambios destructivos
- tests para `lib/lives.js` y `lib/data.js`

## Licencia

MIT
