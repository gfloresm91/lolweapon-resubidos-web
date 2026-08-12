import Link from "next/link";
import { Activity, Archive, Bell, Bookmark, BookOpenText, CalendarDays, CheckCircle2, ChevronDown, CircleDot, DownloadCloud, FileText, History, House, Library, ListOrdered, MessageSquare, Music2, ShieldCheck, Sparkles, Tags, Users } from "lucide-react";

import SocialLinks from "@/components/SocialLinks";

const TOP_LEVEL_ITEMS = [
  {
    key: "home",
    href: "/inicio",
    label: "Inicio",
    icon: House,
    permission: "home.view",
  },
  {
    key: "rtfm",
    href: "/rtfm",
    label: "RTFM",
    icon: FileText,
    permission: "rtfm.view",
  },
  {
    key: "news",
    href: "/novedades",
    label: "Novedades",
    icon: Sparkles,
    permission: "news.view",
  },
  {
    key: "changelog",
    href: "/changelog",
    label: "Historial de cambios",
    icon: History,
    permission: "changelog.view",
  },
];

const ARCHIVE_ITEMS = [
  {
    key: "tracker",
    href: "/rastreador",
    label: "Rastreador de directos",
    icon: Archive,
    permission: "tracker.view",
  },
  {
    key: "trackerCalendar",
    href: "/rastreador/calendario",
    label: "Calendario de directos",
    icon: CalendarDays,
    permission: "tracker.calendar.view",
  },
];

const AUTH_ITEMS = [
  {
    key: "myList",
    href: "/mi-lista",
    label: "Mi lista",
    icon: Bookmark,
    permission: "tracker.view",
  },
];

const ANIME_ITEMS = [
  {
    key: "animeSeasonCalendar",
    href: "/biblioteca-anime/calendario",
    label: "Calendario de temporada",
    icon: CalendarDays,
    permission: "anime.calendar.view",
  },
  {
    key: "animeTierListAnimes",
    href: "/biblioteca-anime/tier-list/animes",
    label: "Tier List: Animes",
    icon: ListOrdered,
    permission: "anime.tierlist.animes.view",
  },
  {
    key: "animeTierListOpenings",
    href: "/biblioteca-anime/tier-list/openings",
    label: "Tier List: OP/ED",
    icon: Music2,
    permission: "anime.tierlist.openings.view",
  },
  {
    key: "animeLibraryTracking",
    href: "/biblioteca-anime/viendo",
    label: "Viendo",
    icon: CircleDot,
    permission: "anime.tracking.view",
  },
  {
    key: "animeLibraryCompleted",
    href: "/biblioteca-anime/terminados",
    label: "Terminados",
    icon: CheckCircle2,
    permission: "anime.completed.view",
  },
  {
    key: "myAnimeList",
    href: "/mi-lista/anime",
    label: "Mi lista anime",
    icon: Bookmark,
    permission: "anime.tracking.view",
    authOnly: true,
  },
];

const READING_ITEMS = [
  {
    key: "spacedrum",
    href: "/spacedrum",
    label: "SpaceDrum",
    icon: BookOpenText,
    permission: "spacedrum.view",
  },
  {
    key: "lightNovel",
    href: "/lecturas/novela-ligera",
    label: "Novela ligera",
    icon: FileText,
    permission: "lightnovel.view",
    isFuture: true,
  },
];

const ADMIN_TREE_ITEMS = [
  {
    key: "platformUsers",
    href: "/administracion/usuarios",
    label: "Usuarios",
    icon: Users,
    permission: "users.read",
  },
  {
    key: "platformRoles",
    href: "/administracion/roles",
    label: "Roles",
    icon: ShieldCheck,
    permission: "roles.read",
  },
  {
    key: "platformNotifications",
    href: "/administracion/notificaciones",
    label: "Notificaciones",
    icon: Bell,
    permission: "admin.notifications.view",
  },
  {
    key: "platformAudience",
    href: "/administracion/audiencia",
    label: "Audiencia web",
    icon: Activity,
    permission: "admin.audience.view",
  },
  {
    key: "platformTickets",
    href: "/administracion/tickets",
    label: "Tickets",
    icon: MessageSquare,
    permission: "admin.tickets.view",
  },
  {
    key: "platformTracker",
    href: "/administracion/rastreador",
    label: "Rastreador",
    icon: Archive,
    permission: "admin.tracker.view",
  },
  {
    key: "platformTags",
    href: "/administracion/tags",
    label: "Tags",
    icon: Tags,
    permission: "admin.tags.view",
  },
  {
    key: "adminAnimeLibrary",
    label: "Biblioteca de anime",
    icon: Library,
    children: [
      {
        key: "platformAnimeSeasonCalendar",
        href: "/administracion/biblioteca-anime/calendario",
        label: "Calendario de temporada",
        icon: CalendarDays,
        permission: "admin.anime.calendar.view",
        manageFlag: "animeCalendar",
      },
      {
        key: "platformAnimeTracking",
        href: "/administracion/biblioteca-anime/viendo",
        label: "Viendo",
        icon: CircleDot,
        permission: "admin.anime.tracking.view",
        manageFlag: "animeTracking",
      },
      {
        key: "platformAnimeCompleted",
        href: "/administracion/biblioteca-anime/terminados",
        label: "Terminados",
        icon: Library,
        permission: "admin.anime.completed.view",
        manageFlag: "animeCompleted",
      },
      {
        key: "platformAnimeTierListAnimes",
        href: "/administracion/biblioteca-anime/tier-list-animes",
        label: "Tier List: Animes",
        icon: ListOrdered,
        permission: "admin.anime.tierlist.animes.view",
      },
      {
        key: "platformAnimeTierListOpenings",
        href: "/administracion/biblioteca-anime/openings",
        label: "Tier List: OP/ED",
        icon: Music2,
        permission: "admin.anime.tierlist.openings.view",
      },
    ],
  },
  {
    key: "platformSpaceDrum",
    label: "SpaceDrum",
    icon: BookOpenText,
    manageFlag: "spaceDrum",
    children: [
      {
        key: "platformSpaceDrumChapters",
        href: "/administracion/spacedrum/capitulos",
        label: "Capítulos",
        icon: BookOpenText,
        permission: "admin.spacedrum.chapters.view",
      },
      {
        key: "platformSpaceDrumPages",
        href: "/administracion/spacedrum/paginas",
        label: "Páginas",
        icon: FileText,
        permission: "admin.spacedrum.pages.view",
      },
      {
        key: "platformSpaceDrumSettings",
        href: "/administracion/spacedrum/configuracion",
        label: "Configuración",
        icon: ShieldCheck,
        permission: "admin.spacedrum.settings.view",
      },
      {
        key: "platformSpaceDrumImport",
        href: "/administracion/spacedrum/importacion",
        label: "Importación",
        icon: DownloadCloud,
        permission: "admin.spacedrum.import.view",
      },
    ],
  },
];

function handleInternalNavigation(event, onSelect, view) {
  if (
    !onSelect
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return;
  }

  event.preventDefault();
  onSelect(view);
}

function SidebarNavItem({ item, activeView, isSectionLink = false, onSelect }) {
  const Icon = item.icon;
  const className = [
    "sidebar-link",
    onSelect ? "sidebar-link-button" : "",
    isSectionLink ? "sidebar-section-link" : "",
    activeView === item.key ? "is-active" : "",
  ].filter(Boolean).join(" ");
  const content = (
    <>
      <span className="sidebar-icon" aria-hidden="true">
        <Icon />
      </span>
      <span>{item.label}</span>
    </>
  );

  if (!onSelect) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={(event) => handleInternalNavigation(event, onSelect, item.key)}
    >
      {content}
    </Link>
  );
}

function isTreeItemActive(item, activeView) {
  return item.key === activeView || item.children?.some((child) => isTreeItemActive(child, activeView));
}

function SidebarTreeGroup({ item, activeView, onSelect, level = 1 }) {
  const Icon = item.icon;
  const isActive = isTreeItemActive(item, activeView);

  return (
    <details className={`sidebar-nav-group sidebar-tree-level-${level} ${isActive ? "is-active" : ""}`} open={isActive || undefined}>
      <summary
        className={`sidebar-link sidebar-section-link sidebar-parent-link ${isActive ? "is-active" : ""}`}
      >
        <span className="sidebar-icon" aria-hidden="true">
          <Icon />
        </span>
        <span>{item.label}</span>
        <ChevronDown className="sidebar-parent-chevron" size={14} aria-hidden="true" />
      </summary>
      <div className="sidebar-submenu" aria-label={`${item.label} submenu`}>
        {item.children.map((child) => (
          child.children?.length ? (
            <SidebarTreeGroup
              key={child.key}
              item={child}
              activeView={activeView}
              onSelect={onSelect}
              level={level + 1}
            />
          ) : (
            <SidebarNavItem
              key={child.key}
              item={child}
              activeView={activeView}
              isSectionLink
              onSelect={onSelect}
            />
          )
        ))}
      </div>
    </details>
  );
}

function canShowManagedItem(item, manageAccess) {
  if (item.manageFlag === "animeTracking") return manageAccess.animeTracking;
  if (item.manageFlag === "animeCompleted") return manageAccess.animeCompleted;
  if (item.manageFlag === "spaceDrum") return manageAccess.spaceDrum;
  if (item.key === "platformTracker") return manageAccess.tracker;
  if (item.key === "platformTags") return manageAccess.tags;
  if (item.key === "platformTickets") return manageAccess.tickets;
  if (item.key === "platformUsers") return manageAccess.users;
  if (item.key === "platformRoles") return manageAccess.roles;
  return true;
}

function filterTreeItems(items, canAccess, manageAccess = {}) {
  return items.reduce((result, item) => {
    if (!canShowManagedItem(item, manageAccess)) return result;

    if (item.children?.length) {
      const children = filterTreeItems(item.children, canAccess, manageAccess);
      if (children.length) result.push({ ...item, children });
      return result;
    }

    if (!item.permission || canAccess(item.permission)) result.push(item);
    return result;
  }, []);
}

export default function AppSidebar({
  activeView,
  className = "",
  id = "main-sidebar",
  canManageUsers = false,
  canManageRoles = false,
  canManageTracker = false,
  canManageTags = false,
  canManageTickets = false,
  canManageSpaceDrum = false,
  canManageAnimeTracking = false,
  canManageAnimeCompleted = false,
  canManageAnimeCalendar = false,
  isAuthenticated = false,
  canAccess = () => true,
  onSelect,
  // isAdmin is intentionally omitted — permissions are controlled individually above
}) {
  const sidebarClassName = ["sidebar", className].filter(Boolean).join(" ");
  const topLevelItems = TOP_LEVEL_ITEMS.filter((item) => canAccess(item.permission) && (!item.authOnly || isAuthenticated));
  const authItems = isAuthenticated ? AUTH_ITEMS.filter((item) => canAccess(item.permission)) : [];
  const archiveItems = filterTreeItems([...ARCHIVE_ITEMS, ...authItems], canAccess);
  const animeItems = ANIME_ITEMS.filter((item) => canAccess(item.permission) && (!item.authOnly || isAuthenticated));
  const readingItems = READING_ITEMS.filter((item) => !item.isFuture && canAccess(item.permission));
  const adminItems = filterTreeItems(ADMIN_TREE_ITEMS, canAccess, {
    animeCompleted: canManageAnimeCompleted,
    animeCalendar: canManageAnimeCalendar,
    animeTracking: canManageAnimeTracking,
    roles: canManageRoles,
    spaceDrum: canManageSpaceDrum,
    tags: canManageTags,
    tickets: canManageTickets,
    tracker: canManageTracker,
    users: canManageUsers,
  });
  const treeGroups = [
    {
      key: "archive",
      label: "Archivo VOD",
      icon: Archive,
      children: archiveItems,
    },
    {
      key: "animeLibrary",
      label: "Biblioteca de anime",
      icon: Library,
      children: animeItems,
    },
    {
      key: "readings",
      label: "Lecturas",
      icon: BookOpenText,
      children: readingItems,
    },
    {
      key: "administration",
      label: "Administración",
      icon: ShieldCheck,
      children: adminItems,
    },
  ].filter((item) => item.children.length);

  return (
    <aside id={id} className={sidebarClassName} aria-label="Menu principal">
      {onSelect ? (
        <Link
          href="/inicio"
          className="sidebar-brand sidebar-brand-button"
          aria-label="Ir al inicio"
          onClick={(event) => handleInternalNavigation(event, onSelect, "home")}
        >
          <span className="sidebar-brand-mark">
            <img src="/brand/lolweapon-logo.png" alt="" />
          </span>
          <span className="sidebar-brand-text">LOLWEAPON</span>
        </Link>
      ) : (
        <Link href="/inicio" className="sidebar-brand sidebar-brand-button" aria-label="Ir al inicio">
          <span className="sidebar-brand-mark">
            <img src="/brand/lolweapon-logo.png" alt="" />
          </span>
          <span className="sidebar-brand-text">LOLWEAPON</span>
        </Link>
      )}

      <nav className="sidebar-nav">
        {topLevelItems.map((item) => (
          <SidebarNavItem key={item.key} item={item} activeView={activeView} onSelect={onSelect} />
        ))}

        <div className="sidebar-tree" aria-label="Secciones del menu">
          {treeGroups.map((item) => (
            <SidebarTreeGroup
              key={item.key}
              item={item}
              activeView={activeView}
              onSelect={onSelect}
            />
          ))}
        </div>

      </nav>

      <div className="sidebar-social-block">
        <span>Redes oficiales</span>
        <SocialLinks compact />
      </div>
    </aside>
  );
}
