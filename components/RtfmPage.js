"use client";

import { useEffect, useMemo, useState } from "react";
import AppLink from "@/components/AppLink";
import {
  AlertTriangle,
  Activity,
  Archive,
  Bell,
  BookOpenText,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  DownloadCloud,
  File,
  FileText,
  ExternalLink,
  FolderOpen,
  History,
  House,
  Info,
  KeyRound,
  Library,
  ListOrdered,
  LogIn,
  MessageCircle,
  Music2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Table,
  Tags,
  User,
  Users,
} from "lucide-react";

const archiveLinks = [
  {
    title: "Web de Piero",
    href: "https://drive.kala-vods.com/",
    icon: History,
    description: "Nacimiento de los resubidos.",
    note: "Creado y mantenido por el bueno de Piero, sin esta fuente original esta web no hubiese existido.",
  },
  {
    title: "Web de resubidos",
    href: "https://resubidos.lolweapon.com/",
    icon: Archive,
    description: "Portal actual del archivo VOD.",
    note: "Créditos al bueno de Redbreake; se utiliza el Excel para la carga base.",
  },
  {
    title: "Excel",
    href: "https://1drv.ms/x/c/87dad8f5b07a6f01/IQABb3qw9djaIICHlm4AAAAAAYc3We7evL0vIGHpS_nUDf8",
    icon: Table,
    description: "Documento histórico utilizado para la carga inicial de los directos.",
    note: "La base de datos de la web es ahora la fuente operativa. Administración puede exportar desde el mantenedor del Rastreador los registros filtrados, completar el archivo y volver a importarlo para actualizar registros existentes de forma controlada.",
    details: [
      "La revisión de importación muestra pasos, contadores, pestañas y diferencias antes de aplicar cualquier cambio.",
      "La operación exige una confirmación final y se bloquea por completo si detecta errores, conflictos, identificadores alterados o filas nuevas.",
    ],
  },
  {
    title: "OneDrive",
    href: "https://1drv.ms/f/c/87dad8f5b07a6f01/EgFverD12NoggIecbgAAAAABfQdUvxmm9D59RsNHjP10dA?e=DWCWlf",
    icon: FolderOpen,
    description: "Directos temporales y peticiones.",
    note: "Directos temporales y peticiones, como se indica al inicio son temporales, se borrarán cuando me dé la puta gana.",
  },
  {
    title: "OKRU",
    href: "https://ok.ru/profile/586016590457/video/channels",
    icon: PlayCircle,
    description: "Playlists de video alojadas en OKRU.",
    note: "La buena madre Rusia, no exenta de las garras del copyright, por lo tanto si hay un directo que no encuentran es porque lo tirotearon y solo estaría disponible en Telegram.",
    details: [
      "Link que lista todas las playlist, es probable que les pida crearse una cuenta para verlos todos, si no quieren crearse cuenta seguir leyendo.",
    ],
  },
  {
    title: "Telegram",
    href: "https://t.me/+WoGrCxyzRy5mZDZh",
    icon: MessageCircle,
    description: "La fuente comunitaria más completa disponible.",
    note: "El bueno de Telegram, todo nació acá, inspirado en el canal de Ilu mantenido por el bueno de Zuka. Inicialmente era de solo uso personal, pero luego debido a que la web de Piero falló se adaptó para la comunidad. Aquí están todos los directos que en su momento se pudieron salvar, es la única fuente que está completa por el momento.",
    warning: "NOTA IMPORTANTE: Hay un BUG en Windows donde el reproductor no funciona del todo bien, te obliga primero a descargar el archivo para poder verlo, esto en móviles y Mac no ocurre, ténganlo en consideración.",
  },
];

const okruYears = [
  { year: "2019", status: "Completo, no necesita cuenta. Mayoría corruptos.", href: "https://ok.ru/video/c46133369" },
  { year: "2020", status: "Completo, no necesita cuenta. Algunos silenciados.", href: "https://ok.ru/video/c46242425" },
  { year: "2021", status: "Completo, no necesita cuenta. Meses de lost media ;(.", href: "https://ok.ru/video/c46741625" },
  { year: "2022", status: "Subiendo, no necesita cuenta.", href: "https://ok.ru/video/c51984249" },
  { year: "2023", status: "Pendiente, no necesita cuenta.", href: "" },
  { year: "2024", status: "Completo, no necesita cuenta.", href: "https://ok.ru/video/c19557753" },
  { year: "2025", status: "Completo, no necesita cuenta.", href: "https://ok.ru/video/c26389369" },
  { year: "2026", status: "Completo, no necesita cuenta.", href: "https://ok.ru/video/c45235065" },
];

const roleLegend = [
  { term: "TW_Tier", description: "Suscripción pagada de Twitch." },
  { term: "TW_VIP", description: "VIP de Twitch; pendiente de autorización." },
  { term: "YT_Miembro", description: "Miembro de YouTube; pendiente de autorización." },
  { term: "Público", description: "Cuenta registrada sin beneficios activos." },
  { term: "Invitado", description: "Usuario sin sesión." },
  { term: "Streamer", description: "Rol especial interno." },
];

const navigationTree = [
  {
    title: "Plataforma",
    icon: FolderOpen,
    children: [
      { title: "Inicio", href: "/inicio", permission: "home.view", icon: House },
      { title: "RTFM", href: "/rtfm", permission: "rtfm.view", icon: FileText },
      { title: "Novedades", href: "/novedades", permission: "news.view", icon: Sparkles },
      { title: "Historial de cambios", href: "/changelog", permission: "changelog.view", icon: History },
      { title: "Notificaciones", href: "/notificaciones", permission: "notifications.full.view", authRequired: true, icon: Bell },
      { title: "Perfil", href: "/perfil", authRequired: true, icon: User },
      { title: "Sugerencias/Reclamos", href: "/sugerencias-reclamos", permission: "support.tickets.view", authRequired: true, icon: MessageCircle },
    ],
  },
  {
    title: "Acceso",
    icon: FolderOpen,
    children: [
      { title: "Login", href: "/login", guestOnly: true, icon: LogIn },
      { title: "Registro", href: "/registro", guestOnly: true, icon: KeyRound },
    ],
  },
  {
    title: "Archivo VOD",
    icon: Archive,
    children: [
      {
        title: "Rastreador de directos",
        href: "/rastreador",
        permission: "tracker.view",
        icon: Archive,
        children: [
          {
            title: "Detalle de directo",
            href: "/rastreador/[id]",
            permission: "tracker.view",
            icon: File,
            children: [
              { title: "Reproductor Piero: controles, Cast y subtítulos", href: "/rastreador/[id]", permission: "tracker.view", icon: PlayCircle },
            ],
          },
        ],
      },
      { title: "Calendario de directos", href: "/rastreador/calendario", permission: "tracker.calendar.view", icon: CalendarDays },
      { title: "Mi lista", href: "/mi-lista", permission: "tracker.view", authRequired: true, icon: Bookmark },
    ],
  },
  {
    title: "Biblioteca de anime",
    icon: Library,
    children: [
      { title: "Calendario de temporada", href: "/biblioteca-anime/calendario", permission: "anime.calendar.view", icon: CalendarDays },
      {
        title: "Tier List: Animes",
        href: "/biblioteca-anime/tier-list/animes",
        permission: "anime.tierlist.animes.view",
        icon: ListOrdered,
      },
      {
        title: "Tier List: OP/ED",
        href: "/biblioteca-anime/tier-list/openings",
        permission: "anime.tierlist.openings.view",
        icon: Music2,
        children: [
          { title: "Tier list compartido", href: "/biblioteca-anime/tier-list/compartido/[shareToken]", publicAccess: true, icon: File },
        ],
      },
      { title: "Viendo", href: "/biblioteca-anime/viendo", permission: "anime.tracking.view", icon: CircleDot },
      { title: "Terminados", href: "/biblioteca-anime/terminados", permission: "anime.completed.view", icon: CheckCircle2 },
      { title: "Mi lista anime", href: "/mi-lista/anime", permission: "anime.tracking.view", authRequired: true, icon: Bookmark },
    ],
  },
  {
    title: "Lecturas",
    icon: BookOpenText,
    children: [
      { title: "SpaceDrum", href: "/spacedrum", permission: "spacedrum.view", icon: BookOpenText },
    ],
  },
  {
    title: "Administración",
    icon: ShieldCheck,
    adminArea: true,
    children: [
      { title: "Usuarios", href: "/administracion/usuarios", permission: "users.read", adminArea: true, icon: Users },
      { title: "Roles", href: "/administracion/roles", permission: "roles.read", adminArea: true, icon: ShieldCheck },
      { title: "Notificaciones", href: "/administracion/notificaciones", permission: "admin.notifications.view", adminArea: true, icon: Bell },
      { title: "Audiencia web", href: "/administracion/audiencia", permission: "admin.audience.view", adminArea: true, icon: Activity },
      { title: "Tickets", href: "/administracion/tickets", permission: "admin.tickets.view", adminArea: true, icon: MessageCircle },
      { title: "Rastreador", href: "/administracion/rastreador", permission: "admin.tracker.view", adminArea: true, icon: Archive },
      { title: "Tags", href: "/administracion/tags", permission: "admin.tags.view", adminArea: true, icon: Tags },
      {
        title: "Biblioteca de anime",
        icon: Library,
        adminArea: true,
        children: [
          { title: "Calendario de temporada", href: "/administracion/biblioteca-anime/calendario", permission: "admin.anime.calendar.view", adminArea: true, icon: CalendarDays },
          { title: "Tier List: Animes", href: "/administracion/biblioteca-anime/tier-list-animes", permission: "admin.anime.tierlist.animes.view", adminArea: true, icon: ListOrdered },
          { title: "Tier List: OP/ED", href: "/administracion/biblioteca-anime/openings", permission: "admin.anime.tierlist.openings.view", adminArea: true, icon: Music2 },
          { title: "Viendo", href: "/administracion/biblioteca-anime/viendo", permission: "admin.anime.tracking.view", adminArea: true, icon: CircleDot },
          { title: "Terminados", href: "/administracion/biblioteca-anime/terminados", permission: "admin.anime.completed.view", adminArea: true, icon: Library },
        ],
      },
      {
        title: "SpaceDrum",
        icon: BookOpenText,
        adminArea: true,
        children: [
          { title: "Capítulos", href: "/administracion/spacedrum/capitulos", permission: "admin.spacedrum.chapters.view", adminArea: true, icon: BookOpenText },
          { title: "Páginas", href: "/administracion/spacedrum/paginas", permission: "admin.spacedrum.pages.view", adminArea: true, icon: FileText },
          { title: "Configuración", href: "/administracion/spacedrum/configuracion", permission: "admin.spacedrum.settings.view", adminArea: true, icon: ShieldCheck },
          { title: "Importación", href: "/administracion/spacedrum/importacion", permission: "admin.spacedrum.import.view", adminArea: true, icon: DownloadCloud },
        ],
      },
    ],
  },
];

function getAuthenticatedRoles(roles) {
  return roles.filter((role) => role.isActive && role.code !== "invitado");
}

function getAccessRoles(item, roles) {
  const activeRoles = roles.filter((role) => role.isActive);

  if (item.guestOnly) {
    return activeRoles.filter((role) => role.code === "invitado");
  }

  if (item.publicAccess) {
    return activeRoles;
  }

  if (!item.permission && item.authRequired) {
    return getAuthenticatedRoles(roles);
  }

  if (!item.permission) {
    return [];
  }

  return activeRoles.filter((role) => role.permissions?.includes(item.permission));
}

function getAccessLabel(item, roles) {
  if (item.guestOnly) return "Solo sin sesión";
  if (item.publicAccess) return "Acceso público";
  if (item.authRequired) return "Requiere sesión";
  if (!roles.length) return item.permission ? "Sin roles activos" : "Según sesión";
  return "Acceso por rol";
}

function getRoleGroup(role) {
  const code = String(role.code || "").toLowerCase();
  const label = String(role.label || "").toLowerCase();

  if (["invitado", "publico"].includes(code)) return "Base";
  if (["dios", "admin", "moderador"].includes(code)) return "Staff";
  if (code.includes("tier") || code.includes("vip") || code.includes("miembro")) return "Comunidad";
  if (code.includes("streamer") || label.includes("streamer") || label.includes("kala")) return "Especial";
  return "Otros";
}

function groupRolesByType(roles) {
  const order = ["Base", "Comunidad", "Staff", "Especial", "Otros"];
  const groups = roles.reduce((result, role) => {
    const group = getRoleGroup(role);
    if (!result[group]) result[group] = [];
    result[group].push(role);
    return result;
  }, {});

  return order
    .filter((group) => groups[group]?.length)
    .map((group) => ({ group, roles: groups[group] }));
}

function getCurrentRoleCode(currentUser) {
  return currentUser?.role || "invitado";
}

function getCurrentRoleLabel(currentUser, roles) {
  const currentRoleCode = getCurrentRoleCode(currentUser);
  return currentUser?.roleLabel
    || roles.find((role) => role.code === currentRoleCode)?.label
    || "Invitado";
}

function countNavigationLeaves(items) {
  return items.reduce((total, item) => (
    total + (item.children?.length ? countNavigationLeaves(item.children) : 1)
  ), 0);
}

function filterNavigationTree(items, canViewAdminDetails) {
  return items.reduce((result, item) => {
    if (item.adminArea && !canViewAdminDetails) return result;

    const children = item.children?.length
      ? filterNavigationTree(item.children, canViewAdminDetails)
      : null;

    if (item.children?.length && !children.length) return result;

    result.push(children ? { ...item, children } : item);
    return result;
  }, []);
}

function NavigationNode({ item, roles, permissionsByCode, canViewAdminDetails, currentRoleCode, level = 1 }) {
  const hasChildren = Boolean(item.children?.length);
  const Icon = item.icon || (hasChildren ? FolderOpen : File);
  const accessRoles = getAccessRoles(item, roles);
  const permission = item.permission ? permissionsByCode.get(item.permission) : null;
  const isInformationalRoute = item.href?.includes("[");
  const roleGroups = groupRolesByType(accessRoles);
  const meta = [
    canViewAdminDetails && item.permission ? item.permission : null,
    item.authRequired ? "Requiere sesión" : null,
    canViewAdminDetails && item.adminArea ? "Administración" : null,
  ].filter(Boolean);

  if (hasChildren) {
    return (
      <li className={`rtfm-nav-node rtfm-nav-branch level-${level}`}>
        <details open={level <= 2}>
          <summary>
            <span className="rtfm-nav-node-main">
              <span className="rtfm-nav-icon is-folder" aria-hidden="true"><Icon size={16} /></span>
              <span className="rtfm-nav-title">{item.title}</span>
            </span>
          </summary>
          <ul className="rtfm-nav-tree-list">
            {item.children.map((child) => (
              <NavigationNode
                key={`${child.title}-${child.href || level}`}
                item={child}
                roles={roles}
                permissionsByCode={permissionsByCode}
                canViewAdminDetails={canViewAdminDetails}
                currentRoleCode={currentRoleCode}
                level={level + 1}
              />
            ))}
          </ul>
        </details>
      </li>
    );
  }

  return (
    <li className="rtfm-nav-node rtfm-nav-leaf">
      <div className="rtfm-nav-leaf-header">
        <div className="rtfm-nav-leaf-main">
          <span className="rtfm-nav-icon" aria-hidden="true"><Icon size={16} /></span>
          <div className="rtfm-nav-copy">
            <strong>{item.title}</strong>
            {item.href && !isInformationalRoute ? <AppLink href={item.href}>{item.href}</AppLink> : null}
            {item.href && isInformationalRoute ? <span className="rtfm-nav-route">{item.href}</span> : null}
          </div>
        </div>
        <span className="rtfm-nav-access-label">{getAccessLabel(item, accessRoles)}</span>
      </div>
      {meta.length ? (
        <div className="rtfm-nav-meta">
          {meta.map((value) => (
            <span key={value} title={value === item.permission ? permission?.label : undefined}>
              {value}
            </span>
          ))}
        </div>
      ) : null}
      <div className="rtfm-nav-roles" aria-label={`Roles con acceso a ${item.title}`}>
        {roleGroups.map(({ group, roles: groupRoles }) => (
          <div key={group} className={`rtfm-nav-role-group is-${group.toLowerCase()}`}>
            <span className="rtfm-nav-role-group-label">{group}:</span>
            <span className="rtfm-nav-role-list">
              {groupRoles.map((role, index) => (
                <span key={role.code}>
                  {index > 0 ? ", " : ""}
                  <span className={role.code === currentRoleCode ? "rtfm-nav-current-role" : undefined} title={role.code === currentRoleCode ? "Rol actual" : undefined}>
                    {role.label}
                  </span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </li>
  );
}

function NavigationMap({ initialRoles, initialPermissions, canViewAdminDetails, currentUser }) {
  const [roles, setRoles] = useState(initialRoles);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [status, setStatus] = useState(initialRoles.length ? "ready" : "idle");

  useEffect(() => {
    if (roles.length && permissions.length) return;

    let isMounted = true;
    setStatus("loading");

    fetch("/api/navigation-map", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el mapa.");
        return response.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setRoles(data.roles || []);
        setPermissions(data.permissions || []);
        setStatus("ready");
      })
      .catch(() => {
        if (isMounted) setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [permissions.length, roles.length]);

  const permissionsByCode = useMemo(() => (
    new Map(permissions.map((permission) => [permission.code, permission]))
  ), [permissions]);
  const visibleNavigationTree = useMemo(
    () => filterNavigationTree(navigationTree, canViewAdminDetails),
    [canViewAdminDetails],
  );
  const visibleScreenCount = useMemo(() => countNavigationLeaves(visibleNavigationTree), [visibleNavigationTree]);
  const currentRoleCode = getCurrentRoleCode(currentUser);
  const currentRoleLabel = getCurrentRoleLabel(currentUser, roles);

  return (
    <section className="news-guide-section rtfm-navigation-section">
      <div className="news-section-heading">
        <span>Mapa de navegación</span>
        <h2>Árbol de pantallas y accesos</h2>
        <p>Vista completa de rutas, permisos y roles activos que pueden entrar a cada pantalla.</p>
      </div>
      <div className="rtfm-notice-panel rtfm-navigation-note" aria-label="Nota sobre roles y beneficios">
        <div className="rtfm-notice is-warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="rtfm-navigation-note-copy">
            <strong>Roles pendientes de autorización</strong>
            <p>
              Por ahora, los beneficios automáticos de la web solo consideran suscripciones pagadas de Twitch.
              Los roles TW_VIP y YT_Miembro no se pueden obtener ni entregar beneficios adicionales hasta que
              Kala autorice su activación (ja!).
            </p>
            <p className="rtfm-current-role-line">
              <span>Tu rol es</span>
              <span className="rtfm-current-role-note">{currentRoleLabel}</span>
            </p>
            <div className="rtfm-role-legend" aria-label="Leyenda de roles">
              <strong>Leyenda de roles</strong>
              <dl>
                {roleLegend.map((item) => (
                  <div key={item.term}>
                    <dt>{item.term}</dt>
                    <dd>{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div className="rtfm-navigation-map" aria-live="polite">
        <div className="rtfm-navigation-toolbar">
          <span><FolderOpen size={15} aria-hidden="true" /> {visibleNavigationTree.length} secciones</span>
          <span><File size={15} aria-hidden="true" /> {visibleScreenCount} pantallas visibles</span>
          <span>{canViewAdminDetails ? "Incluye administración y permisos internos." : "Accesos según tu rol; administración oculta."}</span>
        </div>
        {status === "loading" ? (
          <p className="rtfm-navigation-state">Cargando roles y permisos...</p>
        ) : null}
        {status === "error" ? (
          <p className="rtfm-navigation-state is-error">No se pudo cargar el mapa de navegación.</p>
        ) : null}
        {status !== "error" ? (
          <ul className="rtfm-nav-tree-list is-root">
            {visibleNavigationTree.map((item) => (
              <NavigationNode
                key={item.title}
                item={item}
                roles={roles}
                permissionsByCode={permissionsByCode}
                canViewAdminDetails={canViewAdminDetails}
                currentRoleCode={currentRoleCode}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function SourceCard({ source }) {
  const Icon = source.icon;

  return (
    <article className="rtfm-source-card">
      <div className="rtfm-source-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="rtfm-source-copy">
        <span>{source.title}</span>
        <h3>{source.description}</h3>
        <p>{source.note}</p>
        {source.details?.length ? (
          <ul className="rtfm-source-details">
            {source.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        {source.warning ? (
          <p className="rtfm-source-warning">
            <strong>NOTA IMPORTANTE</strong>
            <span>{source.warning.replace("NOTA IMPORTANTE: ", "")}</span>
          </p>
        ) : null}
      </div>
      <a href={source.href} className="rtfm-source-link" target="_blank" rel="noreferrer">
        <span>Abrir</span>
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </article>
  );
}

export default function RtfmPage({ initialRoles = [], initialPermissions = [], canViewAdminDetails = false, currentUser = null }) {
  return (
    <main className="news-guide-page rtfm-page">
      <section className="news-guide-hero rtfm-hero">
        <h1>
          READ THE FUCKING <span className="text-gradient">MANUAL</span>
        </h1>
        <p>
          Los resubidos actuales nacieron por el miedo a que el drive del buen Piero
          desapareciera algún día y con ello todos los resubidos, que al final terminó
          pasando. Pieroooooooo, tengo la esperanza de que algún día vuelva la web de Piero.
        </p>
      </section>

      <section className="rtfm-notice-panel" aria-label="Notas importantes del archivo">
        <div className="rtfm-notice is-info">
          <Info size={18} aria-hidden="true" />
          <p>
            Todo el material publicado es de libre uso: hagan lo que quieran, a menos que
            Kala diga lo contrario.
          </p>
        </div>
        <div className="rtfm-notice is-info">
          <ExternalLink size={18} aria-hidden="true" />
          <p>
            02-08-2026: Piero ha revivido, repito, Piero ha revivido, esto no es un simulacro{" "}
            <a href="https://drive.kala-vods.com/" target="_blank" rel="noreferrer">
              https://drive.kala-vods.com/
            </a>
          </p>
        </div>
        <div className="rtfm-notice is-warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            Solo están los resubidos que en su momento se pudieron recuperar; hay bastante
            directo perdido.
          </p>
        </div>
        <div className="rtfm-notice is-info">
          <Info size={18} aria-hidden="true" />
          <p>
            La web está optimizada y probada para Chrome en móvil, tablet y escritorio.
            Para otros navegadores me faltan manos; se hace lo que se puede.
          </p>
        </div>
      </section>

      <NavigationMap
        initialRoles={initialRoles}
        initialPermissions={initialPermissions}
        canViewAdminDetails={canViewAdminDetails}
        currentUser={currentUser}
      />

      <section className="news-guide-section">
        <div className="news-section-heading">
          <span>Fuentes principales</span>
          <h2>Dónde está cada cosa</h2>
          <p>Los enlaces originales del archivo, ordenados para consulta rápida.</p>
        </div>
        <div className="rtfm-source-grid">
          {archiveLinks.map((source) => (
            <SourceCard key={source.title} source={source} />
          ))}
        </div>
      </section>

      <section className="news-guide-section">
        <div className="news-section-heading">
          <span>OKRU</span>
          <h2>Playlists por año</h2>
          <p>
            Link que lista todas las playlists. Es probable que OKRU pida crear una cuenta
            para verlos todos; si no quieren crear cuenta, seguir leyendo.
          </p>
        </div>
        <div className="rtfm-year-list">
          {okruYears.map((item) => (
            <article key={item.year} className={`rtfm-year-row ${item.href ? "" : "is-pending"}`}>
              <div>
                <strong>Directos {item.year}</strong>
                <span>{item.status}</span>
              </div>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Abrir playlist OKRU ${item.year}`}>
                  <span>Abrir playlist</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : (
                <span className="rtfm-year-pending">Sin link público</span>
              )}
            </article>
          ))}
        </div>
      </section>

    </main>
  );
}
