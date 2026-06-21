import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Toaster } from "sonner";

import AppSidebar from "@/components/AppSidebar";
import AppSidebarShell from "@/components/AppSidebarShell";
import DetailActivityButtons from "@/components/DetailActivityButtons";
import DetailBackLink from "@/components/DetailBackLink";
import DetailTopbarActions from "@/components/DetailTopbarActions";
import OkruWatchPlayer from "@/components/OkruWatchPlayer";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";
import { SESSION_COOKIE } from "@/lib/auth";
import { getLiveStatusMeta } from "@/lib/liveStatusStyles";
import { getAccessUserFromToken, getCurrentUserFromToken, validateAdminSessionToken } from "@/lib/serverAuth";
import { can } from "@/lib/repositories/platformUserRepository";
import { getLiveWithNeighbors } from "@/lib/repositories/liveRepository";
import { getLiveActivityForLive } from "@/lib/repositories/liveActivityRepository";

export const dynamic = "force-dynamic";

function renderInfoText(text) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="info-link">
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ExternalLinkList({ links, platform }) {
  if (!links.length) {
    return <p className="detail-empty">Sin links cargados.</p>;
  }

  return (
    <ol className="detail-link-list">
      {links.map((href, index) => (
        <li key={`${platform}-${href}-${index}`}>
          <a href={href} target="_blank" rel="noreferrer" className={`platform-btn platform-${platform}`}>
            {platform === "telegram" ? `Telegram ${index + 1}` : `OK.RU ${index + 1}`}
          </a>
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }) {
  const statusMeta = getLiveStatusMeta(status);

  return <span className={statusMeta.badgeFullClassName}>{status || PENDING_LIVE_STATUS_LABEL}</span>;
}

export default async function LiveDetailPage({ params }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const [currentUser, accessUser, isAdmin] = await Promise.all([
    getCurrentUserFromToken(token),
    getAccessUserFromToken(token),
    validateAdminSessionToken(token),
  ]);

  if (!can(accessUser, "tracker.view")) {
    redirect(`/login?next=/rastreador/${encodeURIComponent(decodedId)}`);
  }

  const [{ live, previousLive, nextLive }, initialActivity] = await Promise.all([
    getLiveWithNeighbors(decodedId),
    currentUser?.id ? getLiveActivityForLive(currentUser.id, decodedId) : Promise.resolve(null),
  ]);

  if (!live) {
    notFound();
  }

  const isAuthenticated = Boolean(currentUser?.id);
  const tags = Array.isArray(live.tags) ? live.tags : [];
  const telegramLinks = Array.isArray(live.links?.telegram) ? live.links.telegram : [];
  const okruLinks = Array.isArray(live.links?.okru) ? live.links.okru : [];
  const reportSubject = `Link caido: ${live.title || live.id}`;
  const reportBody = [
    "Hola, quiero reportar un link caido.",
    "",
    `Resubido: ${live.title || "Sin titulo"}`,
    `Fecha: ${live.date || "Sin fecha"}`,
    `ID: ${live.id}`,
  ].join("\n");
  const reportHref = `mailto:kalathraslolweaponvods@gmail.com?subject=${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(reportBody)}`;

  const canManageTracker = can(accessUser, "admin.tracker.view") && (
    can(accessUser, "tracker.create") || can(accessUser, "tracker.update") || can(accessUser, "tracker.delete")
  );
  const canManageAnimeTracking = can(accessUser, "admin.anime.tracking.view") && (
    can(accessUser, "anime.tracking.create") || can(accessUser, "anime.tracking.update") || can(accessUser, "anime.tracking.delete")
  );
  const canManageAnimeCompleted = can(accessUser, "admin.anime.completed.view") && (
    can(accessUser, "anime.completed.create") || can(accessUser, "anime.completed.update") || can(accessUser, "anime.completed.delete")
  );

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <AppSidebarShell extraShellClass="live-detail-app-shell">
        <AppSidebar
          id="main-sidebar"
          activeView="tracker"
          isAdmin={isAdmin}
          canManageUsers={can(accessUser, "users.read")}
          canManageRoles={can(accessUser, "roles.read")}
          canManageTracker={canManageTracker}
          canManageTags={can(accessUser, "admin.tags.view")}
          canManageSpaceDrum={can(accessUser, "admin.spacedrum.chapters.view")}
          canManageAnimeTracking={canManageAnimeTracking}
          canManageAnimeCompleted={canManageAnimeCompleted}
          isAuthenticated={isAuthenticated}
          canAccess={(permission) => can(accessUser, permission)}
        />

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VODs</span>
              <span className="topbar-page">Resubido</span>
            </div>

            <DetailTopbarActions currentUser={currentUser} canManageUsers={can(accessUser, "users.read")} />
          </header>

          <main className="app-wrapper live-detail-page">
            <div className="live-detail-shell">
              <DetailBackLink />
              <nav className="watch-neighbor-nav" aria-label="Navegacion entre resubidos">
                {previousLive ? (
                  <Link
                    href={`/rastreador/${encodeURIComponent(previousLive.id)}`}
                    className="watch-neighbor-link"
                    title={previousLive.title}
                  >
                    <span>Anterior</span>
                    <em>{previousLive.date || "Sin fecha"}</em>
                    <strong>{previousLive.title}</strong>
                  </Link>
                ) : (
                  <span className="watch-neighbor-link is-disabled">Anterior</span>
                )}
                {nextLive ? (
                  <Link
                    href={`/rastreador/${encodeURIComponent(nextLive.id)}`}
                    className="watch-neighbor-link"
                    title={nextLive.title}
                  >
                    <span>Siguiente</span>
                    <em>{nextLive.date || "Sin fecha"}</em>
                    <strong>{nextLive.title}</strong>
                  </Link>
                ) : (
                  <span className="watch-neighbor-link is-disabled">Siguiente</span>
                )}
              </nav>

              <div className="watch-layout">
                <section className="watch-main-column" aria-label="Detalle del resubido">
                  <OkruWatchPlayer
                    links={okruLinks}
                    liveId={live.id}
                    title={live.title}
                    telegramFallbackHref={telegramLinks[0]}
                  />

                  <div className="watch-title-block">
                    <div className="watch-title-row">
                      <h1 className="detail-title">{live.title || "Sin titulo"}</h1>
                      <DetailActivityButtons
                        liveId={live.id}
                        liveTitle={live.title || ""}
                        initialActivity={initialActivity}
                        isAuthenticated={isAuthenticated}
                      />
                    </div>
                    <div className="watch-meta-row">
                      <span>{live.date || "Sin fecha"}</span>
                      {live.year ? <span>{live.year}</span> : null}
                      <StatusBadge status={live.status} />
                    </div>

                    {tags.length ? (
                      <div className="tags-container detail-tags">
                        {tags.map((tag) => (
                          <Link key={tag} href={`/rastreador?tag=${encodeURIComponent(tag)}`} className="tag-pill">
                            {tag}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <section className="watch-description">
                    <h2>Descripcion</h2>
                    {live.additional_info ? (
                      <div className="detail-info-text">{renderInfoText(live.additional_info)}</div>
                    ) : (
                      <p className="detail-empty">Sin informacion adicional.</p>
                    )}
                  </section>
                </section>

                <aside className="watch-side-panel" aria-label="Enlaces del resubido">
                  <section className="watch-links-card">
                    <div className="detail-section-heading">
                      <span className="detail-section-kicker">Resubido</span>
                      <h2>Enlaces</h2>
                    </div>

                    <div className="watch-link-group">
                      <h3>Telegram</h3>
                      <ExternalLinkList links={telegramLinks} platform="telegram" />
                    </div>

                    <a href={reportHref} className="watch-report-link">
                      Reportar link caido
                    </a>
                  </section>
                </aside>
              </div>
            </div>
          </main>

          <footer className="persistent-footer">
            <span>Por fans para fans 💜 para Kala</span>
          </footer>
        </div>
      </AppSidebarShell>
    </>
  );
}
