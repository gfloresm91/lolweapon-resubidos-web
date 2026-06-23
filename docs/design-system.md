# Design System

Estándares visuales y de interacción para mantener la UI homogénea.

## Principios

- Priorizar pantallas útiles sobre páginas explicativas.
- Mantener una estética oscura, limpia, con contraste suficiente y acentos morado/verde/cian solo donde ayuden a entender estado o acción.
- No crear variantes visuales nuevas si ya existe un componente o patrón equivalente.
- Evitar tarjetas dentro de tarjetas. Usar cards solo para items repetidos, modales y herramientas realmente enmarcadas.
- En cambios visuales con trade-offs, explicar la decisión y confirmar antes de aplicar.

## Componentes Reutilizables

Usar primero estos componentes antes de crear algo nuevo:

- `MaintainerTable`: tablas de mantenedores.
- `MaintainerToolbar`: búsqueda y filtros.
- `MaintainerStats`: indicadores superiores.
- `MaintainerModal`: formularios administrativos.
- `ConfirmModal`: confirmaciones y operaciones destructivas.
- `FilterSelect`: filtros en toolbar.
- `FormSelect`: selects dentro de formularios.
- `Tooltip`: tooltips personalizados.
- `AvatarUploader`: subida de imagen/avatar.
- `AniListSearchModal`: búsqueda AniList.

## Tablas De Administración

- Primera columna: `ID`, mostrando `#id`.
- Últimas columnas: `Estado` antes de `Acciones`.
  - Si la entidad no tiene un estado real, no inventar una columna `Estado`; dejar antes de `Acciones` el dato operativo más relevante.
- Acciones en este orden:
  - editar
  - cambiar contraseña, si aplica
  - cambiar estado
  - eliminar
- La búsqueda debe incluir ID cuando el registro tenga ID.
- Las columnas deben representar datos atómicos. Evitar celdas con subtexto repetido cuando ese dato pueda ser una columna propia.
  - El header debe coincidir con el nombre funcional del campo cuando exista formulario equivalente.
  - Ejemplo recomendado en usuarios: `Alias`, `Usuario`, `Email`, `Rol`.
  - Ejemplo recomendado en roles: `Rol`, `Código`, `Permisos`, `Áreas`.
  - Evitar: `Rol` con código debajo o `Permisos` con áreas debajo si eso se repite en todas las filas.
- El texto de datos en columnas administrativas debe mantener una jerarquía tranquila.
  - Usar un color secundario consistente para las celdas de datos.
  - Reservar mayor contraste solo para headers, estados, acciones primarias o casos realmente destacables.
  - Evitar intercalado de filas si genera ruido visual; preferir un fondo uniforme con separadores sutiles.
- Si una métrica tiene columna propia, el header debe explicar la unidad y la celda debe ser breve.
  - Correcto: columna `Permisos` con `9 permisos`.
  - Correcto: columna `Áreas` con `8 áreas`.
  - Evitar duplicar la misma información como línea secundaria.
- Los filtros y la búsqueda deben contemplar todas las columnas visibles relevantes.
  - Si se agregan columnas como `Usuario`, `Código`, `Permisos`, `Áreas` o `Estado`, la búsqueda debe encontrar esos valores.
  - Normalizar acentos cuando aplique: buscar `area` debe poder encontrar `área`.
- Los badges de estado:
  - activo/visible: verde
  - inactivo/oculto: rojo
  - advertencia/pendiente: amarillo/naranja
- Estados del rastreador:
  - `En directo`: verde esmeralda brillante.
  - `Completo`: verde.
  - `Completo/Partes sin audio`: lima/amarillo verdoso.
  - `Subiendo`: azul.
  - `Pendiente`: amarillo.
  - `Incompleto`: naranja.
  - `Incompleto/Partes sin audio`: rojo rosado.
  - `Lost Media`: fucsia/rojo crítico.
  - Usar `getLiveStatusMeta(status)` como fuente única para clases, tonos y futuras leyendas; no duplicar reglas con `includes()` en componentes.
- Filtros y paginación deben seguir el mismo diseño entre mantenedores.
- Ordenamiento:
  - Las columnas ordenables deben mostrar un icono neutro cuando no están activas.
  - La columna activa debe marcar dirección con flecha arriba o abajo.
  - El estado debe exponerse con `aria-sort` y un `aria-label` que indique la dirección actual y la acción siguiente.
- Paginación:
  - No usar `<select>` nativo visible.
  - El selector de cantidad de filas debe usar `FilterSelect` o una variante visualmente equivalente.
  - El menú del selector de filas debe abrir hacia arriba cuando esté en el borde inferior de la pantalla.
  - Debe incluir una opción final `Todos` para ver todos los registros filtrados.
  - Al seleccionar `Todos`, el paginador debe usar el total filtrado actual y actualizar el rango visible.
- Si una tabla crece mucho, preferir paginación y filtros claros antes de agregar más densidad visual.
- Responsive:
  - En desktop no debe haber overflow horizontal global.
  - Las tablas administrativas anchas deben usar scroll horizontal propio, también en desktop cuando el ancho disponible no alcance.
  - `MaintainerTable` debe separar el wrapper externo del área scrolleable:
    - `.maintainer-table-shell`: contenedor general, paginación y espaciado.
    - `.maintainer-table-scroll`: único contenedor con `overflow-x: auto`.
    - `.maintainer-table`: tabla con `min-width: var(--maintainer-table-min-width, 980px)`.
  - Cuando una tabla tenga scroll horizontal real visible, debe mostrarse arriba de la tabla la pista `Desliza horizontalmente para ver más columnas`.
    - La pista debe vivir dentro de `.maintainer-table-scroll` antes de `.maintainer-table`, para desplazarse junto al área de tabla cuando corresponda.
    - No debe mostrarse si la tabla cabe completa en el ancho disponible, aunque use el componente estándar.
    - En pantallas extremadamente angostas puede ocultarse si compite con el espacio útil, pero desktop/tablet/mobile estándar deben mostrarla.
  - El paginador debe quedar fuera de `.maintainer-table-scroll`, para que el scrollbar aparezca inmediatamente bajo la tabla y no después de la paginación.
  - Cada mantenedor ancho debe declarar su `--maintainer-table-min-width` a nivel global, no solo dentro de media queries.
    - El mínimo debe cubrir columnas, gaps, padding y acciones completas.
    - Si las celdas se cortan dentro de la tabla, subir el mínimo antes de comprimir texto o bajar contraste.
  - En mobile, mantener el mismo patrón: scroll horizontal dentro de `.maintainer-table-scroll`, sin mover toda la página.
  - Validar que el scroll horizontal no genere overflow global ni oculte acciones al extremo derecho.
- Verificación mínima para cambios en mantenedores:
  - `npm run build`
  - `git diff --check`
  - Playwright autenticado en desktop y mobile cuando cambie estructura, contraste, filtros, acciones visibles o permisos.
  - Para Playwright, usar un usuario admin local de prueba. No documentar ni commitear credenciales reales; pasarlas por variables locales como `PLAYWRIGHT_ADMIN_LOGIN` y `PLAYWRIGHT_ADMIN_PASSWORD`.
  - Probar búsquedas por cada columna nueva o modificada.
  - Probar indicadores de orden y cambio de cantidad de filas, incluyendo `Todos`.
  - Cuando una tabla requiera scroll horizontal, medir con Playwright que `.maintainer-table-scroll.scrollWidth > .clientWidth`, que `overflow-x` sea `auto` o `scroll`, que `document.documentElement` no tenga overflow global y que las acciones sean visibles al desplazar al extremo derecho.

## Modales

- Fondo sólido estándar; no usar transparencia que mezcle el contenido del fondo.
- Botón cerrar visible arriba a la derecha.
- Espacio superior e inferior equilibrado respecto al viewport y footer persistente.
- Footer del modal fijo solo cuando el contenido sea largo y no debe solapar campos.
- Operaciones destructivas o irreversibles siempre usan confirmación.
- Formularios largos deben agruparse en secciones con títulos cortos.
- En mobile, el contenido debe apilarse y mantener acciones accesibles.

## Formularios

- No mostrar validación nativa HTML5.
- Usar validación visual bajo el campo para errores de campo.
- Usar toast para errores globales o de operación.
- Mantener validaciones homologadas entre:
  - registro
  - perfil
  - usuarios
  - roles
  - mantenedores de contenido
- Campos obligatorios deben tener reglas consistentes en cliente y servidor.
- Inputs y selects deben usar clases estándar (`modal-input`, `FormSelect`, `FilterSelect`).
- Campos de imagen local deben usar uploader con drag and drop y botón de selección.

## Selectores

- No usar `<select>` nativos en pantallas visibles de la app, porque el menú desplegable lo pinta el sistema operativo/navegador y rompe la línea visual oscura del proyecto.
- Para filtros de páginas, toolbars y listados usar siempre `FilterSelect`.
- Para campos dentro de formularios o modales usar siempre `FormSelect`.
- Si se necesita un selector nuevo, primero adaptar `FilterSelect` o `FormSelect`; crear una variante nueva solo si el comportamiento no encaja con esos componentes.
- Caso documentado: en `/changelog`, los filtros `Módulo` y `Tipo` se implementaron inicialmente con `<select>`. Al abrirlos, el dropdown aparecía con estilo nativo claro/gris y no respetaba bordes, contraste ni estados del diseño. Se corrigió reemplazándolos por `FilterSelect` y eliminando el CSS específico del selector nativo.

## Botones

- Acciones primarias: fondo/acento morado.
- Acciones secundarias: fondo oscuro, borde sutil.
- Acciones de historial/auditoría: estilo propio discreto, icono de historial, buen contraste.
- Acciones destructivas: rojo, siempre con confirmación cuando cambian datos.
- Botones de icono deben tener tooltip y `aria-label`.
- En mobile, botones de toolbar deben ocupar ancho completo si se apilan.
- Evitar texto que no quepa dentro del botón; si ocurre, ajustar layout antes que reducir excesivamente fuente.

## Centro De Notificaciones

- El centro vive en `topbar-actions`, antes del menú de cuenta.
- El trigger es un botón circular con `aria-label`, icono de campana y badge compacto de no leídas (`99+` como máximo visual).
- El panel se alinea a la derecha, usa fondo oscuro sólido, borde sutil y sombra consistente con `account-menu`.
- Mantener tabs `Alertas`, `Actividad` y `Sistema`; no agregar más categorías sin necesidad real.
- Usar `Alertas` para señales externas de alto interés comunitario, como Twitch online o nuevo video de YouTube. Usar `Actividad` para contenido agregado dentro de la plataforma. Usar `Sistema` para procesos operativos.
- Cada item debe tener icono, título, texto corto, tiempo relativo y estado no leído claro.
- Acciones esperadas:
  - click en item con `href`: marcar leído y navegar;
  - notificaciones `Alertas` con `href`: abrir en pestaña nueva para no sacar al usuario de la pantalla actual;
  - item sin `href`: marcar leído;
  - botón de descartar;
  - footer `Marcar todo como leído`.
- En mobile el panel debe usar `width: calc(100vw - 2rem)` como máximo, scroll interno y no generar overflow global.
- El contador debe refrescar sin recargar la página usando WebSocket; mantener polling suave como respaldo cuando el canal no esté disponible.
- El panel debe superponerse sobre el player y chat de Twitch sin ocultarlos en desktop, igual que `account-menu`.
- Si una acción que genera notificación falla al crearla, no debe romper la operación principal.
- Para videos de YouTube, el productor principal es el sincronizador de `server.mjs`; no debe depender de que el usuario visite `/inicio`. La primera sincronización debe quedar como línea base silenciosa; solo videos detectados después se muestran como alerta nueva.
- Invitados solo deben ver notificaciones públicas (`audience: all`): Twitch online, nuevo video de YouTube y comunicaciones públicas de novedades/changelog. No deben ver actividad interna autenticada ni sistema administrativo.
- Para invitados, leído/descartado se guarda en `localStorage`; para usuarios autenticados se guarda en `PlatformUserNotification`.
- Novedades/changelog deben crearse con `dedupeKey` estable para no duplicarse al reiniciar `server.mjs`.

### Capas Sobre Twitch

- Problema observado en `/inicio`: el centro de notificaciones quedaba sobre el chat, pero bajo el player principal, y el topbar también se pintaba bajo el player.
- Causa: `.app-shell` tenía `z-index: 1`, creando un stacking context completo. Aunque `.topbar` tuviera un `z-index` alto, seguía atrapado dentro de esa capa y no podía superar al `PersistentTwitchPlayer`, que es `position: fixed` en la capa raíz.
- Intento incorrecto: ocultar `.persistent-twitch-player`, `iframe`, `.twitch-player-anchor` o `.twitch-player-embed` cuando se abría el centro. Eso evitaba el solape, pero hacía desaparecer el video/chat y no coincidía con el comportamiento del menú de usuario.
- Solución correcta aplicada: quitar el `z-index` de `.app-shell`, mantener `.topbar` por encima del player (`z-index: 900`) y dejar `.notification-popover`/`.account-menu-popover` como capas internas del topbar. Así el dropdown se superpone sin apagar iframes.
- Regla para futuras pantallas: antes de subir números de `z-index`, revisar si algún contenedor padre creó un stacking context con `z-index`, `transform`, `filter`, `opacity`, `contain`, `isolation` o `position` combinada con `z-index`.
- No ocultar iframes cross-origin como primera solución en desktop. Solo usar ocultación puntual en responsive/menús laterales cuando el embed impida interacción o genere overflow, y documentar el alcance.

## Cards

### Novedades

- Usar cards informativas de una sola capa para beneficios, novedades y tutoriales.
- La primera pantalla debe priorizar beneficios por tipo de usuario antes que una lista de cambios.
- Las CTAs se adaptan a la sesión: invitado, usuario registrado y administración.
- Las comparativas deben ser livianas y responsivas; evitar tablas densas de administración.

### Rastreador

- Mantener separación clara entre metadata, tags, disponibilidad y acciones.
- El botón principal para ver el resubido usa icono tipo play.
- Acciones personales deben ser sutiles y no competir con el CTA principal.
- En modo compacto, evitar solapes entre badges, editar y ver resubido.

### Biblioteca De Anime

- Modo cómodo: card visual con poster, esfera de nota destacada si existe, acciones personales, progreso y CTA.
- Modo compacto: tabla visual con miniatura, anime, progreso, nota y acciones.
- En `Terminados`, no usar badge de estado sobre imagen si `Viendo` no lo usa; homologar presentación.
- La descripción del anime no debe aparecer como overlay si compite con la esfera de puntuación.

## Chulopuntos

- Escala visible: 1.0 a 8.0, con décimas.
- La esfera destacada del card muestra la nota del rol con permiso `anime.rating.streamer`.
- El texto recomendado para nota destacada es `Nota destacada por Kala`.
- El botón de nota personal debe decir `Tu nota` cuando el usuario ya calificó.
- El modal debe tener espacio suficiente: esfera, ajuste fino, rangos y acciones no deben solaparse.
- Rango visual:
  - 1-2: bajo
  - 3-4: regular
  - 5-6: bueno
  - 7-8: excelente

## Estados Sin Sesión

- Botones que requieren sesión se pueden mostrar, pero no deben redirigir inmediatamente.
- Al hacer click:
  - mostrar toast/modal explicando que debe iniciar sesión
  - ofrecer acción `Iniciar sesión`
- Esto aplica a favoritos, listas personales, visto/guardado y calificaciones.

## Responsive

- No escalar tipografía con viewport.
- Usar grids con `minmax`, `auto`, `aspect-ratio` y constraints estables.
- Evitar solapes con header, footer persistente y sidebars.
- Probar visualmente cambios grandes en desktop y mobile.

## Rendimiento Visual

- En pantallas con muchas cards, evitar combinar sombras grandes, múltiples gradientes, filtros y transiciones de `transform`; esa mezcla puede provocar parpadeos al hacer scroll.
- Si aparece flicker/titileo durante el scroll, estabilizar primero el CSS:
  - aislar el contenedor principal con `isolation: isolate`;
  - usar `contain: paint` en hero/cards repetidas;
  - reemplazar `box-shadow` grandes por sombras internas o bordes sutiles;
  - quitar hover basado en `transform` cuando el grid es largo.
- Caso documentado: la página `Novedades` parpadeaba al hacer scroll por repintados caros de cards con gradientes y sombras. Se resolvió conteniendo pintura y reduciendo sombras sin cambiar la estructura visual.

## Accesibilidad

- Botones de icono: `aria-label`.
- Modales: cierre visible y click fuera cuando aplique.
- Tooltips: no deben reemplazar texto crítico para usuarios de teclado.
- Estados activos deben comunicarse visualmente y con `aria-pressed` cuando corresponda.
