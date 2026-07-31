"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownAZ, Music2, Play, X } from "lucide-react";

import AnimePosterImage from "@/components/AnimePosterImage";
import { KIND_LABELS, SEASON_LABELS } from "@/lib/animeTierListLabels";

const DEFAULT_FILTERS = { showDefault: true, showAdult: false, showDonghua: false, showSpoiler: false };
const DEFAULT_TIME_ZONE = "UTC";

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const match = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      if (match) return match[2];
    }
  } catch {
    return null;
  }
  return null;
}

function extractDriveFileId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return null;
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (match) return match[1];
    return parsed.searchParams.get("id");
  } catch {
    return null;
  }
}

function isOneDriveEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "1drv.ms" || parsed.hostname.endsWith(".onedrive.live.com") || parsed.hostname === "onedrive.live.com";
  } catch {
    return false;
  }
}

function resolveVideoEmbed(url) {
  if (!url) return null;
  const youTubeId = extractYouTubeId(url);
  if (youTubeId) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${youTubeId}` };
  const driveId = extractDriveFileId(url);
  if (driveId) return { type: "drive", embedUrl: `https://drive.google.com/file/d/${driveId}/preview` };
  if (isOneDriveEmbedUrl(url)) return { type: "onedrive", embedUrl: url };
  return { type: "video", embedUrl: url };
}

function normalizeRosterItem(kind, item) {
  if (kind === "animes") {
    return {
      id: item.id,
      entryId: null,
      title: item.title,
      imageUrl: item.imageUrl,
      badge: null,
      isAdult: item.isAdult,
      isDonghua: item.isDonghua,
      isSpoiler: false,
      isHidden: item.isHidden,
    };
  }
  return {
    id: item.id,
    entryId: item.tierListEntryId,
    title: item.animeTitle,
    imageUrl: item.imageUrl,
    badge: item.sequence,
    sequence: item.sequence,
    isAdult: item.isAdult,
    isDonghua: item.isDonghua,
    isSpoiler: item.isSpoiler,
    isHidden: item.isHidden,
    videoUrl: item.videoUrl,
    primarySourceLabel: item.primarySourceLabel || null,
    alternateVideoUrls: Array.isArray(item.alternateVideoUrls) ? item.alternateVideoUrls : [],
    songTitle: item.songTitle,
  };
}

function applySequenceBadges(roster) {
  const visibleCounts = new Map();
  for (const item of roster) {
    if (item.entryId == null || item.isHidden) continue;
    visibleCounts.set(item.entryId, (visibleCounts.get(item.entryId) || 0) + 1);
  }
  return roster.map((item) => {
    const hasSiblings = item.entryId != null && (visibleCounts.get(item.entryId) || 0) > 1;
    const hasMeaningfulSequence = item.badge != null && item.badge > 1;
    return hasSiblings || hasMeaningfulSequence ? item : { ...item, badge: null };
  });
}

function passesFilters(item, filters) {
  if (item.isSpoiler && !filters.showSpoiler) return false;
  if (item.isAdult) return filters.showAdult;
  if (item.isDonghua) return filters.showDonghua;
  return filters.showDefault;
}

function computeContentCounts(roster, filters) {
  const counts = { default: 0, adult: 0, donghua: 0, spoiler: 0, hiddenByPreferences: 0 };
  for (const item of roster) {
    if (item.isHidden) continue;
    if (item.isAdult) counts.adult += 1;
    else if (item.isDonghua) counts.donghua += 1;
    else counts.default += 1;
    if (item.isSpoiler) counts.spoiler += 1;
    if (!passesFilters(item, filters)) counts.hiddenByPreferences += 1;
  }
  return counts;
}

function buildContainers(roster, tiers, placements, filters) {
  const itemsById = new Map(roster.map((item) => [item.id, item]));
  const placedIds = new Set();
  const containers = { _pool: [] };
  for (const tier of tiers) containers[tier.key] = [];

  for (const placement of placements) {
    const item = itemsById.get(placement.itemId);
    if (!item) continue;
    const tierKey = placement.tierKey && containers[placement.tierKey] ? placement.tierKey : null;
    if (item.isHidden) {
      // Un item oculto solo se mantiene visible si está genuinamente rankeado en una fila.
      if (!tierKey) continue;
      containers[tierKey].push(placement.itemId);
      placedIds.add(placement.itemId);
      continue;
    }
    if (!passesFilters(item, filters)) continue;
    containers[tierKey || "_pool"].push(placement.itemId);
    placedIds.add(placement.itemId);
  }

  for (const item of roster) {
    if (placedIds.has(item.id) || item.isHidden || !passesFilters(item, filters)) continue;
    containers._pool.push(item.id);
  }

  return { containers, itemsById };
}

function formatUpdatedAt(date, timeZone) {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(date));
}

function TierListCard({ itemId, itemsById, onOpen }) {
  const item = itemsById.get(itemId);
  if (!item) return null;
  return (
    <div
      className={`tierlist-card ${item.isHidden ? "is-hidden-by-admin" : ""}`}
      onClick={() => item.videoUrl && onOpen?.(item)}
      role={item.videoUrl ? "button" : undefined}
      tabIndex={item.videoUrl ? 0 : undefined}
      onKeyDown={(event) => {
        if (item.videoUrl && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen?.(item);
        }
      }}
      title={item.title}
    >
      <div className="tierlist-card-media">
        <AnimePosterImage src={item.imageUrl} title={item.title} className="tierlist-card-poster" decorative />
        {item.badge ? <span className="tierlist-card-badge">{item.badge}</span> : null}
        {item.isAdult || item.isDonghua ? (
          <div className="tierlist-card-flags">
            {item.isAdult ? <span className="tierlist-card-flag is-adult">18+</span> : null}
            {item.isDonghua ? <span className="tierlist-card-flag is-donghua">Donghua</span> : null}
          </div>
        ) : null}
        {item.videoUrl ? <span className="tierlist-card-play"><Play size={22} /></span> : null}
        {item.isHidden ? <span className="tierlist-card-hidden-flag">Oculto por administración</span> : null}
      </div>
      <span className="tierlist-card-title">{item.title}</span>
    </div>
  );
}

export default function PublicAnimeTierListPage({ tierList }) {
  const { owner, season, kind, roster: rawRoster, tiers, placements, updatedAt } = tierList;
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [openItem, setOpenItem] = useState(null);
  const [videoSource, setVideoSource] = useState("primary");
  const [videoError, setVideoError] = useState(false);
  const [isPoolSorted, setIsPoolSorted] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimeZone(detected);
  }, []);

  useEffect(() => {
    setVideoError(false);
    setVideoSource("primary");
  }, [openItem?.id]);

  function switchVideoSource(source) {
    setVideoSource(source);
    setVideoError(false);
  }

  const roster = useMemo(
    () => applySequenceBadges(rawRoster.map((item) => normalizeRosterItem(kind, item))),
    [rawRoster, kind],
  );
  const { containers, itemsById } = useMemo(
    () => buildContainers(roster, tiers, placements, filters),
    [roster, tiers, placements, filters],
  );
  const contentCounts = useMemo(() => computeContentCounts(roster, filters), [roster, filters]);
  const updatedAtLabel = formatUpdatedAt(updatedAt, timeZone);
  const poolItemIds = useMemo(() => {
    const ids = containers._pool || [];
    if (!isPoolSorted) return ids;
    return [...ids].sort((leftId, rightId) => {
      const left = itemsById.get(leftId);
      const right = itemsById.get(rightId);
      return (left?.title || "").localeCompare(right?.title || "") || (left?.sequence || 0) - (right?.sequence || 0);
    });
  }, [containers, isPoolSorted, itemsById]);
  const videoSources = useMemo(() => {
    if (!openItem) return [];
    return [
      { key: "primary", label: openItem.primarySourceLabel || "Fuente principal", url: openItem.videoUrl },
      ...(openItem.alternateVideoUrls || []).map((source, index) => ({
        key: `alt-${index}`,
        label: source.label || "Fuente alternativa",
        url: source.url,
      })),
    ].filter((source) => source.url);
  }, [openItem]);
  const activeVideoUrl = videoSources.find((source) => source.key === videoSource)?.url || videoSources[0]?.url;
  const videoEmbed = activeVideoUrl ? resolveVideoEmbed(activeVideoUrl) : null;

  return (
    <main className="tierlist-page tierlist-page-readonly">
      <div className="tierlist-readonly-brand">
        <Link href="/inicio" className="sidebar-brand" aria-label="Ir a Lolweapon">
          <span className="sidebar-brand-mark"><img src="/brand/lolweapon-logo.png" alt="" /></span>
          <span className="sidebar-brand-text">LOLWEAPON</span>
        </Link>
      </div>

      <header className="watching-header">
        <h1 className="title">Tier List de {KIND_LABELS[kind] || kind} <span className="text-gradient">de {owner?.alias || owner?.login}</span></h1>
        <p className="subtitle">{season ? `${SEASON_LABELS[season.season] || season.season} ${season.year}` : ""} · Solo lectura</p>
        {updatedAtLabel ? <p className="tierlist-readonly-updated">Actualizado el {updatedAtLabel}</p> : null}
      </header>

      <section className="tierlist-toolbar" aria-label="Filtros del tier list">
        <div className="season-calendar-toggles">
          <button
            type="button"
            className={`season-calendar-toggle ${filters.showDefault ? "is-active" : ""}`}
            aria-pressed={filters.showDefault}
            onClick={() => setFilters((current) => ({ ...current, showDefault: !current.showDefault }))}
          >
            Mostrar estándar ({contentCounts.default})
          </button>
          <button
            type="button"
            className={`season-calendar-toggle ${filters.showAdult ? "is-active" : ""}`}
            aria-pressed={filters.showAdult}
            onClick={() => setFilters((current) => ({ ...current, showAdult: !current.showAdult }))}
          >
            Mostrar adulto ({contentCounts.adult})
          </button>
          <button
            type="button"
            className={`season-calendar-toggle ${filters.showDonghua ? "is-active" : ""}`}
            aria-pressed={filters.showDonghua}
            onClick={() => setFilters((current) => ({ ...current, showDonghua: !current.showDonghua }))}
          >
            Mostrar donghua ({contentCounts.donghua})
          </button>
          {kind !== "animes" ? (
            <button
              type="button"
              className={`season-calendar-toggle ${filters.showSpoiler ? "is-active" : ""}`}
              aria-pressed={filters.showSpoiler}
              onClick={() => setFilters((current) => ({ ...current, showSpoiler: !current.showSpoiler }))}
            >
              Mostrar sin versión limpia ({contentCounts.spoiler})
            </button>
          ) : null}
        </div>
        <p className="season-calendar-summary" aria-live="polite">
          {contentCounts.hiddenByPreferences
            ? `${contentCounts.hiddenByPreferences} ocultos por tus preferencias`
            : "Todo el contenido disponible está visible"}
        </p>
      </section>

      <div className="tierlist-board">
        <div className="tierlist-rows">
          {tiers.map((tier) => {
            const itemIds = containers[tier.key] || [];
            return (
              <div className="tierlist-row" key={tier.key}>
                <div className="tierlist-row-label" style={{ backgroundColor: tier.color }}>
                  <span>{tier.label}</span>
                </div>
                <div className={`tierlist-row-drop ${itemIds.length ? "" : "is-empty"}`}>
                  {itemIds.length ? null : <span className="tierlist-row-empty-hint">Sin animes</span>}
                  {itemIds.map((itemId) => (
                    <TierListCard key={itemId} itemId={itemId} itemsById={itemsById} onOpen={setOpenItem} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {poolItemIds.length ? (
          <div className="tierlist-pool">
            <div className="tierlist-pool-header">
              <h2>Sin rankear <span className="tierlist-pool-count">({poolItemIds.length})</span></h2>
              <div className="tierlist-pool-header-actions">
                <button type="button" className="tracker-action-secondary" onClick={() => setIsPoolSorted((current) => !current)}>
                  <ArrowDownAZ size={16} /> Ordenar alfabéticamente
                </button>
              </div>
            </div>
            <div className="tierlist-row-drop tierlist-pool-drop">
              {poolItemIds.map((itemId) => (
                <TierListCard key={itemId} itemId={itemId} itemsById={itemsById} onOpen={setOpenItem} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {openItem ? (
        <div className="modal-backdrop" onClick={() => setOpenItem(null)}>
          <div className="modal-content tierlist-video-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close-button" aria-label="Cerrar" onClick={() => setOpenItem(null)}><X size={18} /></button>
            <h2 className="modal-title">{openItem.title}{openItem.badge ? ` — #${openItem.badge}` : ""}</h2>
            {openItem.songTitle ? (
              <p className="tierlist-video-song"><Music2 size={14} aria-hidden="true" /> {openItem.songTitle}</p>
            ) : null}
            {videoSources.length > 1 ? (
              <div className="tracker-calendar-view-toggle tierlist-video-source-toggle" role="tablist" aria-label="Fuente del video">
                {videoSources.map((source) => (
                  <button
                    key={source.key}
                    type="button"
                    role="tab"
                    aria-selected={videoSource === source.key}
                    className={videoSource === source.key ? "is-active" : ""}
                    onClick={() => switchVideoSource(source.key)}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
            {videoEmbed ? (
              videoError ? (
                <p className="field-hint tierlist-video-error">No se pudo cargar el video.</p>
              ) : videoEmbed.type === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={`${openItem.id}-${videoSource}`}
                  src={videoEmbed.embedUrl}
                  poster={openItem.imageUrl || undefined}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(event) => event.preventDefault()}
                  className="tierlist-video-player"
                  onError={() => setVideoError(true)}
                />
              ) : (
                <iframe
                  key={`${openItem.id}-${videoSource}`}
                  src={videoEmbed.embedUrl}
                  title={openItem.title}
                  className="tierlist-video-player tierlist-video-frame"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen *"
                  allowFullScreen
                />
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
