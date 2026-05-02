import Link from "next/link";
import { Archive, BookOpenText, CheckCircle2, CircleDot, House } from "lucide-react";

import SocialLinks from "@/components/SocialLinks";

const SIDEBAR_ITEMS = [
  {
    key: "home",
    href: "/inicio",
    label: "Inicio",
    icon: House,
  },
  {
    key: "tracker",
    href: "/rastreador",
    label: "Rastreador de directos",
    icon: Archive,
  },
];

const ANIME_ITEMS = [
  {
    key: "animeLibraryTracking",
    href: "/biblioteca-anime/viendo",
    label: "Viendo",
    icon: CircleDot,
  },
  {
    key: "animeLibraryCompleted",
    href: "/biblioteca-anime/terminados",
    label: "Terminados",
    icon: CheckCircle2,
  },
];

const SPACEDRUM_ITEM = {
  key: "spacedrum",
  href: "/spacedrum",
  label: "SpaceDrum",
  icon: BookOpenText,
};

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
  isSpaceDrumEnabled = false,
  onSelect,
}) {
  const sidebarClassName = ["sidebar", className].filter(Boolean).join(" ");

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
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarNavItem key={item.key} item={item} activeView={activeView} onSelect={onSelect} />
        ))}

        <div className="sidebar-section">
          <span className="sidebar-section-label">Biblioteca de anime</span>
          <div className="sidebar-section-links" aria-label="Biblioteca de anime">
            {ANIME_ITEMS.map((item) => (
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

        {isSpaceDrumEnabled ? (
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
