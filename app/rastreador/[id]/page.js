import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import AppSidebar from "@/components/AppSidebar";
import DetailSidebarControls from "@/components/DetailSidebarControls";
import DetailTopbarActions from "@/components/DetailTopbarActions";
import OkruWatchPlayer from "@/components/OkruWatchPlayer";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/auth";
import { readLives } from "@/lib/repositories/liveRepository";

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
  const normalized = String(status || "").toLowerCase();
  let className = "status-badge status-badge--pendiente";

  if (normalized.includes("completo")) className = "status-badge status-badge--completo";
  if (normalized.includes("lost")) className = "status-badge status-badge--lost";
  if (normalized.includes("subiendo")) className = "status-badge status-badge--subiendo";

  return <span className={className}>{status || PENDING_LIVE_STATUS_LABEL}</span>;
}

function parseLiveSortDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export default async function LiveDetailPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const isAdmin = validateSessionToken(token);
  const lives = await readLives();
  const sortedLives = [...lives].sort((left, right) => {
    const dateCompare = parseLiveSortDate(left.date).localeCompare(parseLiveSortDate(right.date));

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(left.id || "").localeCompare(String(right.id || ""));
  });
  const liveIndex = sortedLives.findIndex((item) => item.id === decodeURIComponent(id));
  const live = sortedLives[liveIndex];

  if (!live) {
    notFound();
  }

  const tags = Array.isArray(live.tags) ? live.tags : [];
  const telegramLinks = Array.isArray(live.links?.telegram) ? live.links.telegram : [];
  const okruLinks = Array.isArray(live.links?.okru) ? live.links.okru : [];
  const previousLive = liveIndex > 0 ? sortedLives[liveIndex - 1] : null;
  const nextLive = liveIndex < sortedLives.length - 1 ? sortedLives[liveIndex + 1] : null;
  const reportSubject = `Link caido: ${live.title || live.id}`;
  const reportBody = [
    "Hola, quiero reportar un link caido.",
    "",
    `Resubido: ${live.title || "Sin titulo"}`,
    `Fecha: ${live.date || "Sin fecha"}`,
    `ID: ${live.id}`,
  ].join("\n");
  const reportHref = `mailto:kalathraslolweaponvods@gmail.com?subject=${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(reportBody)}`;

  return (
    <>
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <div className="app-shell live-detail-app-shell">
        <DetailSidebarControls />

        <AppSidebar
          activeView="tracker"
          isSpaceDrumEnabled={process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM === "true"}
        />

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VODs</span>
              <span className="topbar-page">Resubido</span>
            </div>

            <DetailTopbarActions isAdmin={isAdmin} />
          </header>

          <main className="app-wrapper live-detail-page">
            <div className="live-detail-shell">
              <Link href="/rastreador" className="detail-back-link">
                Volver al rastreador
              </Link>
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
                    <h1 className="detail-title">{live.title || "Sin titulo"}</h1>
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
      </div>
    </>
  );
}
