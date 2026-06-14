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
- Acciones en este orden:
  - editar
  - cambiar contraseña, si aplica
  - cambiar estado
  - eliminar
- La búsqueda debe incluir ID cuando el registro tenga ID.
- Los badges de estado:
  - activo/visible: verde
  - inactivo/oculto: rojo
  - advertencia/pendiente: amarillo/naranja
- Filtros y paginación deben seguir el mismo diseño entre mantenedores.
- Si una tabla crece mucho, preferir paginación y filtros claros antes de agregar más densidad visual.

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
