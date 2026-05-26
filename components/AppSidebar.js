import Link from "next/link";
import { Archive, Bookmark, BookOpenText, CheckCircle2, ChevronDown, CircleDot, DownloadCloud, FileText, House, Library, ShieldCheck, Tags, Users } from "lucide-react";

import SocialLinks from "@/components/SocialLinks";

const SIDEBAR_ITEMS = [
  {
    key: "home",
    href: "/inicio",
    label: "Inicio",
    icon: House,
    permission: "home.view",
  },
  {
    key: "tracker",
    href: "/rastreador",
    label: "Rastreador de directos",
    icon: Archive,
    permission: "tracker.view",
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

const ADMIN_ITEMS = [
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
    key: "platformSpaceDrum",
    label: "SpaceDrum",
    icon: BookOpenText,
    permission: "admin.spacedrum.chapters.view",
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
  {
    key: "platformAnimeTracking",
    href: "/administracion/biblioteca-anime/viendo",
    label: "Viendo",
    icon: CircleDot,
    permission: "admin.anime.tracking.view",
  },
  {
    key: "platformAnimeCompleted",
    href: "/administracion/biblioteca-anime/terminados",
    label: "Terminados",
    icon: Library,
    permission: "admin.anime.completed.view",
  },
];

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

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={() => onSelect(item.key)}>
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function isNavItemActive(item, activeView) {
  return item.key === activeView || item.children?.some((child) => child.key === activeView);
}

function SidebarNavGroup({ item, activeView, onSelect }) {
  const Icon = item.icon;
  const isActive = isNavItemActive(item, activeView);

  return (
    <div className={`sidebar-nav-group ${isActive ? "is-active" : ""}`}>
      <div className={`sidebar-link sidebar-section-link sidebar-parent-link ${isActive ? "is-active" : ""}`}>
        <span className="sidebar-icon" aria-hidden="true">
          <Icon />
        </span>
        <span>{item.label}</span>
        <ChevronDown className="sidebar-parent-chevron" size={14} aria-hidden="true" />
      </div>
      <div className="sidebar-submenu" aria-label={`${item.label} submenu`}>
        {item.children.map((child) => (
          <SidebarNavItem
            key={child.key}
            item={child}
            activeView={activeView}
            isSectionLink
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppSidebar({
  activeView,
  className = "",
  id = "main-sidebar",
  canManageUsers = false,
  canManageRoles = false,
  canManageTracker = false,
  canManageTags = false,
  canManageSpaceDrum = false,
  canManageAnimeTracking = false,
  canManageAnimeCompleted = false,
  isAuthenticated = false,
  canAccess = () => true,
  onSelect,
  // isAdmin is intentionally omitted — permissions are controlled individually above
}) {
  const sidebarClassName = ["sidebar", className].filter(Boolean).join(" ");
  const sidebarItems = SIDEBAR_ITEMS.filter((item) => canAccess(item.permission));
  const authItems = isAuthenticated ? AUTH_ITEMS.filter((item) => canAccess(item.permission)) : [];
  const animeItems = ANIME_ITEMS.filter((item) => canAccess(item.permission) && (!item.authOnly || isAuthenticated));
  const readingItems = READING_ITEMS.filter((item) => !item.isFuture && canAccess(item.permission));
  const adminItems = ADMIN_ITEMS.filter((item) => {
    if (item.children?.length) {
      if (item.key === "platformSpaceDrum") {
        return canManageSpaceDrum && item.children.some((child) => canAccess(child.permission));
      }
      return item.children.some((child) => canAccess(child.permission));
    }
    if (item.key === "platformAnimeTracking") return canManageAnimeTracking && canAccess(item.permission);
    if (item.key === "platformAnimeCompleted") return canManageAnimeCompleted && canAccess(item.permission);
    if (item.key === "platformTracker") return canManageTracker && canAccess(item.permission);
    if (item.key === "platformTags") return canManageTags && canAccess(item.permission);
    if (item.key === "platformUsers") return canManageUsers && canAccess(item.permission);
    if (item.key === "platformRoles") return canManageRoles && canAccess(item.permission);
    return false;
  });

  return (
    <aside id={id} className={sidebarClassName} aria-label="Menu principal">
      {onSelect ? (
        <button
          type="button"
          className="sidebar-brand sidebar-brand-button"
          aria-label="Ir al inicio"
          onClick={() => onSelect("home")}
        >
          <span className="sidebar-brand-mark">
            <img src="/brand/lolweapon-logo.png" alt="" />
          </span>
          <span className="sidebar-brand-text">LOLWEAPON</span>
        </button>
      ) : (
        <Link href="/inicio" className="sidebar-brand sidebar-brand-button" aria-label="Ir al inicio">
          <span className="sidebar-brand-mark">
            <img src="/brand/lolweapon-logo.png" alt="" />
          </span>
          <span className="sidebar-brand-text">LOLWEAPON</span>
        </Link>
      )}

      <nav className="sidebar-nav">
        {sidebarItems.map((item) => (
          <SidebarNavItem key={item.key} item={item} activeView={activeView} onSelect={onSelect} />
        ))}

        {authItems.map((item) => (
          <SidebarNavItem key={item.key} item={item} activeView={activeView} onSelect={onSelect} />
        ))}

        {animeItems.length ? <div className="sidebar-section">
          <span className="sidebar-section-label">Biblioteca de anime</span>
          <div className="sidebar-section-links" aria-label="Biblioteca de anime">
            {animeItems.map((item) => (
              <SidebarNavItem
                key={item.key}
                item={item}
                activeView={activeView}
                isSectionLink
                onSelect={onSelect}
              />
            ))}
          </div>
        </div> : null}

        {readingItems.length ? (
          <div className="sidebar-section">
            <span className="sidebar-section-label">Lecturas</span>
            <div className="sidebar-section-links" aria-label="Lecturas">
              {readingItems.map((item) => (
                <SidebarNavItem
                  key={item.key}
                  item={item}
                  activeView={activeView}
                  isSectionLink
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ) : null}

        {adminItems.length ? (
          <div className="sidebar-section">
            <span className="sidebar-section-label">Administración</span>
            <div className="sidebar-section-links" aria-label="Administración">
              {adminItems.map((item) => (
                item.children?.length ? (
                  <SidebarNavGroup
                    key={item.key}
                    item={{
                      ...item,
                      children: item.children.filter((child) => canAccess(child.permission)),
                    }}
                    activeView={activeView}
                    onSelect={onSelect}
                  />
                ) : (
                  <SidebarNavItem
                    key={item.key}
                    item={item}
                    activeView={activeView}
                    isSectionLink
                    onSelect={onSelect}
                  />
                )
              ))}
            </div>
          </div>
        ) : null}

      </nav>

      <div className="sidebar-social-block">
        <span>Redes oficiales</span>
        <SocialLinks compact />
      </div>
    </aside>
  );
}
