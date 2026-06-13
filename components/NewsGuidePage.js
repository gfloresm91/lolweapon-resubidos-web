"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookmarkCheck,
  BookOpenCheck,
  Check,
  Compass,
  History,
  Lock,
  LogIn,
  Sparkles,
  Star,
  UserPlus,
  UserRoundCog,
  X,
  ShieldCheck,
} from "lucide-react";

import {
  newsGuideBenefits,
  newsGuideComparison,
  newsGuideHowTo,
  newsGuideTutorials,
  newsGuideUpdates,
} from "@/lib/newsGuideContent";
import { changelogEntries } from "@/lib/changelogContent";

function hasPermission({ permissions = [], role }, code) {
  return role === "dios" || permissions.includes(code);
}

function withReturnTo(href, returnTo) {
  if (!href || !returnTo || !["/login", "/registro"].includes(href)) {
    return href;
  }

  return `${href}?returnTo=${encodeURIComponent(returnTo)}`;
}

const ADMIN_NAV_LINKS = [
  { code: "users.read", label: "Usuarios", href: "/administracion/usuarios", icon: UserRoundCog },
  { code: "roles.read", label: "Roles", href: "/administracion/roles", icon: ShieldCheck },
  { code: "admin.tracker.view", label: "Rastreador", href: "/administracion/rastreador", icon: History },
  { code: "admin.tags.view", label: "Tags", href: "/administracion/tags", icon: BadgeCheck },
  { code: "admin.spacedrum.chapters.view", label: "SpaceDrum", href: "/administracion/spacedrum/capitulos", icon: BookOpenCheck },
  { code: "admin.spacedrum.pages.view", label: "Páginas SpaceDrum", href: "/administracion/spacedrum/paginas", icon: BookOpenCheck },
  { code: "admin.spacedrum.settings.view", label: "Configurar SpaceDrum", href: "/administracion/spacedrum/configuracion", icon: UserRoundCog },
  { code: "admin.spacedrum.import.view", label: "Importar SpaceDrum", href: "/administracion/spacedrum/importacion", icon: History },
  { code: "admin.anime.tracking.view", label: "Viendo", href: "/administracion/biblioteca-anime/viendo", icon: Compass },
  { code: "admin.anime.completed.view", label: "Terminados", href: "/administracion/biblioteca-anime/terminados", icon: Check },
];

const ICONS = {
  BadgeCheck,
  BookmarkCheck,
  BookOpenCheck,
  Check,
  Compass,
  History,
  LogIn,
  ShieldCheck,
  Star,
  UserRoundCog,
};

function getAllowedAdminLinks({ permissions = [], role }) {
  return ADMIN_NAV_LINKS.filter((link) => hasPermission({ permissions, role }, link.code));
}

function getIsAdminLike({ permissions = [], role }) {
  return role === "dios"
    || permissions.includes("users.read")
    || permissions.includes("roles.read")
    || permissions.some((permission) => permission.startsWith("admin."));
}

function getCanSeeAdminPreview({ permissions = [], role, isAdminLike = false }) {
  const normalizedRole = String(role || "").toLowerCase();

  return isAdminLike
    || ["dios", "admin", "moderador", "moderator", "streamer"].includes(normalizedRole)
    || permissions.includes("anime.rating.streamer");
}

function getPrimaryActions({ isAuthenticated, isAdminLike, adminLanding, hasSpaceDrumAccess }) {
  if (!isAuthenticated) {
    return [
      { label: "Iniciar sesión", href: "/login", icon: LogIn, variant: "primary" },
      { label: "Registrarme", href: "/registro", icon: UserPlus, variant: "secondary" },
    ];
  }

  if (isAdminLike) {
    return [
      { label: "Ver administración", href: adminLanding?.href || "/perfil", icon: Lock, variant: "primary" },
      { label: "Configurar perfil", href: "/perfil", icon: Star, variant: "secondary" },
    ];
  }

  const actions = [
    { label: "Ir a mi lista", href: "/mi-lista", icon: BookOpenCheck, variant: "primary" },
    { label: "Mi lista anime", href: "/mi-lista/anime", icon: BookmarkCheck, variant: "secondary" },
  ];

  if (hasSpaceDrumAccess) {
    actions.push({ label: "Continuar SpaceDrum", href: "/spacedrum", icon: BookOpenCheck, variant: "secondary" });
  }

  actions.push({ label: "Configurar perfil", href: "/perfil", icon: Star, variant: "secondary" });

  return actions;
}

function ActionLink({ action, returnTo = "" }) {
  const Icon = action.icon || ArrowRight;
  return (
    <Link href={withReturnTo(action.href, returnTo)} className={`news-guide-action news-guide-action-${action.variant || "secondary"}`}>
      <Icon size={16} aria-hidden="true" />
      <span>{action.label}</span>
    </Link>
  );
}

function getCommunityCta({ isAuthenticated, isTwitchConnected }) {
  if (!isAuthenticated) {
    return { label: "Iniciar sesión", href: "/login" };
  }

  if (isTwitchConnected) {
    return { label: "Cuenta Twitch conectada", href: null, muted: true };
  }

  return { label: "Conectar Twitch", href: "/api/auth/twitch/start" };
}

function resolveRestrictedCta({
  cta,
  isAuthenticated,
  isAdminLike,
  adminLinks = [],
  permissions = [],
  role,
}) {
  if (!cta) {
    return null;
  }

  if (cta.permissionCode && !hasPermission({ permissions, role }, cta.permissionCode)) {
    if (!isAuthenticated) {
      return {
        label: cta.loginLabel || cta.lockedLabel || "Iniciar sesión",
        href: "/login",
        muted: false,
      };
    }

    return {
      label: cta.lockedLabel || "Disponible según rol",
      href: null,
      muted: true,
    };
  }

  if (cta.authOnly && !isAuthenticated) {
    return {
      label: cta.loginLabel || "Iniciar sesión",
      href: "/login",
      muted: false,
    };
  }

  if (cta.adminOnly && !isAdminLike) {
    return {
      label: "Disponible para roles administrativos",
      href: null,
      muted: true,
    };
  }

  if (cta.adminOnly && isAdminLike) {
    const directAccess = adminLinks.some((link) => link.href === cta.href);
    const fallback = adminLinks[0];

    return {
      label: directAccess ? cta.label : fallback?.label ? `Ir a ${fallback.label}` : "Ir a administración",
      href: directAccess ? cta.href : fallback?.href || null,
      muted: !directAccess && !fallback,
    };
  }

  if (isAuthenticated && ["/login", "/registro"].includes(cta.href)) {
    return {
      label: "Configurar perfil",
      href: "/perfil",
      muted: false,
    };
  }

  return {
    label: cta.label,
    href: cta.href,
    muted: false,
  };
}

function RestrictedLink({ cta, className = "news-guide-card-link", returnTo = "" }) {
  if (!cta) {
    return null;
  }

  const DisabledIcon = cta.label.toLowerCase().includes("conectada") ? Check : Lock;
  const content = (
    <>
      <span>{cta.label}</span>
      {cta.href ? <ArrowRight size={15} aria-hidden="true" /> : <DisabledIcon size={15} aria-hidden="true" />}
    </>
  );

  if (!cta.href) {
    return (
      <span className={`${className} is-muted is-disabled`} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={withReturnTo(cta.href, returnTo)} className={`${className} ${cta.muted ? "is-muted" : ""}`}>
      {content}
    </Link>
  );
}

function BenefitCard({ benefit, isAuthenticated, isAdminLike, adminLinks, isTwitchConnected, returnTo = "" }) {
  const rawCta = benefit.key === "community"
    ? getCommunityCta({ isAuthenticated, isTwitchConnected })
    : benefit.cta;
  const cta = resolveRestrictedCta({ cta: rawCta, isAuthenticated, isAdminLike, adminLinks });
  const Icon = ICONS[benefit.icon] || Sparkles;

  return (
    <article className={`news-benefit-card news-accent-${benefit.accent} ${benefit.featured ? "is-featured" : ""}`}>
      <div className="news-benefit-head">
        <span className="news-benefit-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <div className="news-card-kicker">{benefit.audience}</div>
          <h3>{benefit.title}</h3>
        </div>
      </div>
      <p>{benefit.description}</p>
      <ul>
        {benefit.items.map((item) => (
          <li key={item}>
            <Check size={14} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <RestrictedLink cta={cta} returnTo={returnTo} />
    </article>
  );
}

function UpdateCard({ update, isAuthenticated, isAdminLike, adminLinks, permissions, role, returnTo = "" }) {
  const Icon = ICONS[update.icon] || Sparkles;
  const cta = resolveRestrictedCta({
    cta: update.href
      ? {
          label: update.cta || "Ver módulo",
          href: update.href,
          authOnly: update.authOnly,
          adminOnly: update.adminOnly,
          permissionCode: update.permissionCode,
          loginLabel: update.loginLabel,
          lockedLabel: update.lockedLabel,
        }
      : null,
    isAuthenticated,
    isAdminLike,
    adminLinks,
    permissions,
    role,
  });

  return (
    <article className="news-update-card">
      <div className="news-update-head">
        <span className="news-update-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <div className="news-update-context">
            <span className="news-update-type">{update.type}</span>
            <span>{update.module}</span>
            <span>{update.date}</span>
          </div>
          <h3>{update.title}</h3>
        </div>
      </div>
      <p>{update.description}</p>
      <div className="news-update-cta">
        <span className="news-update-audience">{update.audience}</span>
        <RestrictedLink cta={cta} className="news-guide-card-link" returnTo={returnTo} />
      </div>
    </article>
  );
}

function TutorialCard({ tutorial, isAuthenticated, isAdminLike, adminLinks, permissions, role, returnTo = "" }) {
  const cta = resolveRestrictedCta({
    cta: {
      label: tutorial.cta,
      href: tutorial.href,
      authOnly: tutorial.authOnly,
      adminOnly: tutorial.adminOnly,
      permissionCode: tutorial.permissionCode,
      loginLabel: tutorial.loginLabel,
      lockedLabel: tutorial.lockedLabel,
    },
    isAuthenticated,
    isAdminLike,
    adminLinks,
    permissions,
    role,
  });

  return (
    <article className="news-tutorial-card">
      <div className="news-card-kicker">{tutorial.module}</div>
      <ol>
        {tutorial.steps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <RestrictedLink cta={cta} className="news-guide-card-link news-tutorial-link" returnTo={returnTo} />
    </article>
  );
}

function HowToCard({ item }) {
  const Icon = ICONS[item.icon] || Sparkles;

  return (
    <article className="news-howto-card">
      <div className="news-howto-head">
        <span className="news-howto-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <h3>{item.title}</h3>
      </div>
      <ol>
        {item.steps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}

function getLatestReleaseLabel(releases = []) {
  const latest = releases[0];

  if (!latest) {
    return "Actualizado recientemente";
  }

  return `Actualizado al ${latest.version}`;
}

function ComparisonStatus({ enabled }) {
  if (typeof enabled === "string") {
    return (
      <span className="news-comparison-status is-conditional">
        <Sparkles size={14} aria-hidden="true" />
        <span>{enabled}</span>
      </span>
    );
  }

  return (
    <span className={`news-comparison-status ${enabled ? "is-enabled" : "is-disabled"}`}>
      {enabled ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
      <span>{enabled ? "Sí" : "No"}</span>
    </span>
  );
}

function getClosingContent({ isAuthenticated, isAdminLike, adminLinks = [] }) {
  if (isAdminLike) {
    const actions = adminLinks.slice(0, 2).map((link, index) => ({
      label: index === 0 ? `Ir a ${link.label}` : `Ver ${link.label}`,
      href: link.href,
      icon: link.icon,
      variant: index === 0 ? "primary" : "secondary",
    }));

    return {
      kicker: "Siguiente paso",
      title: "Mantén permisos y cambios bajo control",
      description: "Revisa roles, usuarios e historial para asegurarte de que cada módulo quede alineado con la operación real.",
      actions: actions.length > 0
        ? actions
        : [{ label: "Configurar perfil", href: "/perfil", icon: Star, variant: "primary" }],
    };
  }

  if (isAuthenticated) {
    return {
      kicker: "Continúa",
    title: "Tus listas son el mejor punto de partida",
      description: "Vuelve a tus directos guardados, tu seguimiento de anime o tu lectura de SpaceDrum cuando tengas el beneficio activo.",
      actions: [
        { label: "Ir a mi lista", href: "/mi-lista", icon: BookmarkCheck, variant: "primary" },
        { label: "Mi lista anime", href: "/mi-lista/anime", icon: BookOpenCheck, variant: "secondary" },
      ],
    };
  }

  return {
    kicker: "Crea tu cuenta",
    title: "Explora sin cuenta, guarda al iniciar sesión",
    description: "Una cuenta te permite guardar directos, marcar vistos, mantener listas, personalizar tu perfil y conservar progreso de lectura.",
    actions: [
      { label: "Registrarme", href: "/registro", icon: UserPlus, variant: "primary" },
      { label: "Iniciar sesión", href: "/login", icon: LogIn, variant: "secondary" },
    ],
  };
}

function getAccessibleHighlights({ isAuthenticated, isAdminLike, permissions = [], role }) {
  if (isAdminLike) {
    const items = [];

    if (hasPermission({ permissions, role }, "users.read")) {
      items.push("Usuarios");
    }

    if (hasPermission({ permissions, role }, "roles.read")) {
      items.push("Roles");
    }

    if (hasPermission({ permissions, role }, "admin.tracker.view")) {
      items.push("Rastreador");
    }

    if (hasPermission({ permissions, role }, "admin.tags.view")) {
      items.push("Tags");
    }

    if (
      hasPermission({ permissions, role }, "admin.anime.tracking.view")
      || hasPermission({ permissions, role }, "admin.anime.completed.view")
    ) {
      items.push("Anime");
    }

    if (
      hasPermission({ permissions, role }, "admin.spacedrum.chapters.view")
      || hasPermission({ permissions, role }, "admin.spacedrum.pages.view")
      || hasPermission({ permissions, role }, "admin.spacedrum.settings.view")
    ) {
      items.push("SpaceDrum");
    }

    items.push("Auditoría");

    return [...new Set(items)].slice(0, 6);
  }

  if (!isAuthenticated) {
    return ["Rastreador público", "Biblioteca de anime", "Resubidos", "Novedades"];
  }

  const items = ["Mi lista", "Mi lista anime", "Perfil"];

  if (permissions.includes("anime.rating.write")) {
    items.push("Chulopuntos");
  }

  if (permissions.includes("anime.rating.streamer")) {
    items.push("Nota destacada");
  }

  if (permissions.includes("spacedrum.view")) {
    items.push("Progreso SpaceDrum");
  }

  return items.slice(0, 5);
}

export default function NewsGuidePage({ currentUser = null, permissions = [] }) {
  const [returnTo, setReturnTo] = useState("");
  const isAuthenticated = Boolean(currentUser?.id);
  const currentRole = currentUser?.role;
  const isTwitchConnected = Boolean(
    currentUser?.twitchId
    || currentUser?.twitchUserId
    || currentUser?.twitchLogin
    || currentUser?.provider === "twitch"
    || currentUser?.authProvider === "twitch"
    || currentUser?.origin === "twitch"
  );
  const isAdminLike = getIsAdminLike({ permissions, role: currentRole });
  const canSeeAdminPreview = getCanSeeAdminPreview({ permissions, role: currentRole, isAdminLike });
  const adminLinks = getAllowedAdminLinks({ permissions, role: currentRole });
  const adminLanding = adminLinks[0] || null;
  const hasSpaceDrumAccess = hasPermission({ permissions, role: currentRole }, "spacedrum.view");
  const primaryActions = getPrimaryActions({ isAuthenticated, isAdminLike, adminLanding, hasSpaceDrumAccess });
  const closingContent = getClosingContent({ isAuthenticated, isAdminLike, adminLinks });
  const accessHighlights = getAccessibleHighlights({ isAuthenticated, isAdminLike, permissions, role: currentRole });
  const visibleBenefits = newsGuideBenefits.filter((benefit) => {
    if (["admin", "moderator"].includes(benefit.key)) {
      return canSeeAdminPreview;
    }

    return true;
  });
  const visibleUpdates = newsGuideUpdates.filter((update) => !update.adminOnly || canSeeAdminPreview);
  const visibleTutorials = newsGuideTutorials.filter((tutorial) => !tutorial.adminOnly || canSeeAdminPreview);
  const latestReleaseLabel = getLatestReleaseLabel(changelogEntries);

  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, []);

  return (
    <main className="news-guide-page">
      <section className="news-guide-hero">
        <div className="header-badge news-guide-badge">
          <Sparkles size={14} aria-hidden="true" />
          Novedades y guía
        </div>
        <h1>
          Novedades y <span className="text-gradient">guía de uso</span>
        </h1>
        <p>
          Descubre qué puedes hacer en la plataforma, qué funciones nuevas se agregaron
          y qué beneficios tienes al iniciar sesión.
        </p>
        <div className="news-guide-actions">
          {primaryActions.map((action) => (
            <ActionLink key={`${action.href}-${action.label}`} action={action} returnTo={returnTo} />
          ))}
        </div>
        <div className="news-guide-session-note">
          <span>{latestReleaseLabel}</span>
          <span>
            {isAuthenticated
              ? `${currentUser?.alias || currentUser?.login || "Usuario"}${currentUser?.roleLabel ? ` · ${currentUser.roleLabel}` : ""}`
              : "Explora sin cuenta. Inicia sesión para guardar tu progreso."}
          </span>
        </div>
        <nav className="news-guide-anchor-nav" aria-label="Secciones de novedades">
          <a href="#beneficios">Beneficios</a>
          <a href="#comparativa">Invitado vs registrado</a>
          <a href="#novedades-recientes">Novedades</a>
          <a href="#guias">Guías</a>
        </nav>
      </section>

      <section className="news-current-access">
        <div>
          <span>Según tu cuenta</span>
          <strong>
            {isAdminLike
              ? "Tu rol actual habilita funciones administrativas."
              : isAuthenticated
                ? "Tu cuenta ya puede guardar progreso y personalizar experiencia."
                : "Puedes explorar sin cuenta y desbloquear seguimiento al iniciar sesión."}
          </strong>
        </div>
        <div className="news-current-access-tags">
          {accessHighlights.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="news-access-strip" aria-label="Cómo funciona el acceso">
        <strong>Funciones públicas y beneficios configurables.</strong>
        <p>La página se adapta a tu sesión; algunos accesos dependen del rol y permisos asignados.</p>
      </section>

      <section id="beneficios" className="news-guide-section">
        <div className="news-section-heading">
          <span>Beneficios</span>
          <h2>Qué gana cada tipo de usuario</h2>
          <p>La plataforma cambia según sesión y permisos, pero la guía queda visible para que sepas qué puedes desbloquear.</p>
        </div>
        <div className="news-benefits-grid">
          {visibleBenefits.map((benefit) => (
            <BenefitCard
              key={benefit.key}
              benefit={benefit}
              isAuthenticated={isAuthenticated}
              isAdminLike={isAdminLike}
              adminLinks={adminLinks}
              isTwitchConnected={isTwitchConnected}
              returnTo={returnTo}
            />
          ))}
        </div>
      </section>

      <section id="comparativa" className="news-guide-section news-comparison-section">
        <div className="news-section-heading">
          <span>Invitado vs registrado</span>
          <h2>Por qué conviene iniciar sesión</h2>
          <p>La navegación pública sigue disponible, pero una cuenta permite guardar tus propias marcas y progreso.</p>
        </div>
        <div className="news-comparison-card">
          <div className="news-comparison-row is-header">
            <span>Función</span>
            <span>Invitado</span>
            <span>Registrado</span>
          </div>
          <div className="news-comparison-mobile-header" aria-hidden="true">
            <span>Invitado</span>
            <span>Registrado</span>
          </div>
          {newsGuideComparison.map((item) => (
            <div key={item.feature} className="news-comparison-row">
              <span>{item.feature}</span>
              <ComparisonStatus enabled={item.guest} />
              <ComparisonStatus enabled={item.registered} />
            </div>
          ))}
        </div>
        <div className="news-comparison-cta">
          <p>Al iniciar sesión puedes guardar directos, listas, perfil y progreso según tu rol.</p>
          {isAuthenticated ? (
            <ActionLink action={{ label: "Ir a mi lista", href: "/mi-lista", icon: BookmarkCheck, variant: "primary" }} returnTo={returnTo} />
          ) : (
            <>
              <ActionLink action={{ label: "Crear cuenta", href: "/registro", icon: UserPlus, variant: "primary" }} returnTo={returnTo} />
              <ActionLink action={{ label: "Iniciar sesión", href: "/login", icon: LogIn, variant: "secondary" }} returnTo={returnTo} />
            </>
          )}
        </div>
      </section>

      <section id="novedades-recientes" className="news-guide-section">
        <div className="news-section-heading">
          <span>Novedades recientes</span>
          <h2>Qué hay nuevo</h2>
          <p>Los cambios más útiles para usuarios, comunidad y administración, con acceso directo al módulo correspondiente.</p>
        </div>
        <div className="news-updates-grid">
          {visibleUpdates.map((update) => (
            <UpdateCard
              key={`${update.module}-${update.title}`}
              update={update}
              isAuthenticated={isAuthenticated}
              isAdminLike={isAdminLike}
              adminLinks={adminLinks}
              permissions={permissions}
              role={currentRole}
              returnTo={returnTo}
            />
          ))}
        </div>
        <div className="news-guide-section-cta">
          <div className="news-guide-section-cta-icon" aria-hidden="true">
            <History size={20} />
          </div>
          <div className="news-guide-section-cta-copy">
            <span>Historial completo</span>
            <strong>Revisa toda la evolución</strong>
            <p>El changelog tiene su propia página para consultar versiones, mejoras y correcciones sin mezclarlo con la guía.</p>
          </div>
          <Link href="/changelog" className="news-guide-card-link">
            <span>Ver historial de cambios</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="guias" className="news-guide-section">
        <div className="news-section-heading">
          <span>Módulos principales</span>
          <h2>Qué hace cada módulo</h2>
          <p>Una lectura rápida para ubicar cada sección de la plataforma sin convertir la página en un manual pesado.</p>
        </div>
        <div className="news-tutorial-grid">
          {visibleTutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.module}
              tutorial={tutorial}
              isAuthenticated={isAuthenticated}
              isAdminLike={isAdminLike}
              adminLinks={adminLinks}
              permissions={permissions}
              role={currentRole}
              returnTo={returnTo}
            />
          ))}
        </div>
      </section>

      <section className="news-guide-section">
        <div className="news-section-heading">
          <span>Tutoriales en 3 pasos</span>
          <h2>Acciones frecuentes</h2>
          <p>Pasos breves para las acciones que más ayudan a sacar partido a tu cuenta.</p>
        </div>
        <div className="news-howto-grid">
          {newsGuideHowTo.map((item) => (
            <HowToCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      {isAdminLike && adminLinks.length > 0 ? (
        <section className="news-guide-admin-note">
          <History size={18} aria-hidden="true" />
          <div>
            <strong>Administración auditada</strong>
            <p>Las acciones en mantenedores quedan registradas para facilitar trazabilidad y revisión de cambios.</p>
          </div>
          <div className="news-guide-admin-actions">
            {adminLinks.slice(0, 3).map((link) => (
              <Link key={link.href} href={link.href} className="news-guide-inline-link">
                <span>{link.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="news-guide-final-cta">
        <div>
          <span>{closingContent.kicker}</span>
          <h2>{closingContent.title}</h2>
          <p>{closingContent.description}</p>
        </div>
        <div className="news-guide-final-actions">
          {closingContent.actions.map((action) => (
            <ActionLink key={`${action.href}-${action.label}`} action={action} returnTo={returnTo} />
          ))}
        </div>
      </section>
    </main>
  );
}
