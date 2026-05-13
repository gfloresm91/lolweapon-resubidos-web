import Link from "next/link";
import { Archive, BookOpenText, CheckCircle2, CircleDot, House, ShieldCheck, Users } from "lucide-react";

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
];

const SPACEDRUM_ITEM = {
  key: "spacedrum",
  href: "/spacedrum",
  label: "SpaceDrum",
  icon: BookOpenText,
  permission: "spacedrum.view",
};

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

export default function AppSidebar({
  activeView,
  className = "",
  id = "main-sidebar",
  canManageUsers = false,
  canManageRoles = false,
  isSpaceDrumEnabled = false,
  canAccess = () => true,
  onSelect,
}) {
  const sidebarClassName = ["sidebar", className].filter(Boolean).join(" ");
  const sidebarItems = SIDEBAR_ITEMS.filter((item) => canAccess(item.permission));
  const animeItems = ANIME_ITEMS.filter((item) => canAccess(item.permission));
  const adminItems = ADMIN_ITEMS.filter((item) => {
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

        {adminItems.length ? (
          <div className="sidebar-section">
            <span className="sidebar-section-label">Administración</span>
            <div className="sidebar-section-links" aria-label="Administración">
              {adminItems.map((item) => (
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

        {isSpaceDrumEnabled && canAccess(SPACEDRUM_ITEM.permission) ? (
          <SidebarNavItem item={SPACEDRUM_ITEM} activeView={activeView} onSelect={onSelect} />
        ) : null}
      </nav>

      <div className="sidebar-social-block">
        <span>Redes oficiales</span>
        <SocialLinks compact />
      </div>
    </aside>
  );
}
