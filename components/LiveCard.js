"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BellRing, Bell, CheckCircle2, ChevronDown, ChevronUp, CirclePlay, Edit3, FileText, ImageIcon, Link2, MoreVertical } from "lucide-react";

import Tooltip from "@/components/Tooltip";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";
import { getLiveStatusMeta } from "@/lib/liveStatusStyles";
import { getLivePosterResources, PIERO_POSTER_BANNER_SIZES, PIERO_PREVIEW_FRAME_COUNT } from "@/lib/pieroPoster";

const PREVIEW_INTENT_DELAY_MS = 450;
const PREVIEW_FRAME_DURATION_MS = 800;
let activePreviewStop = null;
let visibilityListenerInstalled = false;

function claimPreview(stop) {
  activePreviewStop?.();
  activePreviewStop = stop;

  if (!visibilityListenerInstalled) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        activePreviewStop?.();
        activePreviewStop = null;
      }
    });
    visibilityListenerInstalled = true;
  }
}

function releasePreview(stop) {
  if (activePreviewStop === stop) activePreviewStop = null;
}

function LivePoster({ live, resources, onOpen, interactive = true }) {
  const intentTimerRef = useRef(null);
  const stopPreviewRef = useRef(null);
  const posterImgRef = useRef(null);
  const [posterUrl, setPosterUrl] = useState(resources?.posterUrl || "");
  const [srcsetFailed, setSrcsetFailed] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);

  useEffect(() => {
    setPosterUrl(resources?.posterUrl || "");
    setSrcsetFailed(false);
    setPreviewActive(false);
    setPreviewLoaded(false);
    setPreviewUnavailable(false);
    setPreviewFrame(0);
  }, [resources?.posterUrl]);

  useEffect(() => {
    if (!previewActive || !previewLoaded) return undefined;
    const interval = window.setInterval(() => {
      setPreviewFrame((current) => (current + 1) % PIERO_PREVIEW_FRAME_COUNT);
    }, PREVIEW_FRAME_DURATION_MS);
    return () => window.clearInterval(interval);
  }, [previewActive, previewLoaded]);

  if (!stopPreviewRef.current) {
    stopPreviewRef.current = () => {
      window.clearTimeout(intentTimerRef.current);
      setPreviewActive(false);
      setPreviewFrame(0);
    };
  }

  useEffect(() => () => {
    releasePreview(stopPreviewRef.current);
    window.clearTimeout(intentTimerRef.current);
  }, []);

  function beginPreview() {
    if (
      !interactive ||
      !resources?.previewUrl ||
      previewUnavailable ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    window.clearTimeout(intentTimerRef.current);
    intentTimerRef.current = window.setTimeout(() => {
      claimPreview(stopPreviewRef.current);
      setPreviewFrame(0);
      setPreviewActive(true);
    }, PREVIEW_INTENT_DELAY_MS);
  }

  function stopPreview() {
    releasePreview(stopPreviewRef.current);
    stopPreviewRef.current();
  }

  // Banner de la card cómoda: srcset con descriptores `w` + `sizes`.
  // Miniatura de tamaño fijo (tabla): srcset con descriptores de densidad.
  const thumbSources = resources?.posterSources;
  const posterSrcSet = interactive
    ? resources?.posterSrcset
    : thumbSources && thumbSources.length >= 3
      ? `${thumbSources[0].url} 1x, ${thumbSources[1].url} 2x, ${thumbSources[2].url} 3x`
      : undefined;
  const posterSizes = interactive ? PIERO_POSTER_BANNER_SIZES : undefined;

  function handlePosterError() {
    // Un tamaño de la escalera puede faltar (set legado sin regenerar):
    // reintenta una vez solo con el alias antes de caer al placeholder.
    if (!srcsetFailed && posterSrcSet) {
      setSrcsetFailed(true);
      return;
    }
    setPosterUrl("");
  }

  function handlePosterLoad(event) {
    // Un 404 cross-origin servido como HTML puede bloquearse por ORB y disparar
    // `load` con una imagen vacía en vez de `error`; lo tratamos como fallo.
    if (event.currentTarget.naturalWidth === 0) handlePosterError();
  }

  // El srcset puede haber fallado antes de la hidratación (sin disparar
  // `onError` en React, p. ej. un 404 bloqueado por ORB): al montar,
  // comprobamos el estado real del <img> y caemos al alias.
  useEffect(() => {
    const img = posterImgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && !srcsetFailed && posterSrcSet) {
      setSrcsetFailed(true);
    }
  }, [srcsetFailed, posterSrcSet, posterUrl]);

  return (
    <button
      type="button"
      className="live-thumb"
      aria-label={`Abrir ${live.title || "directo"}`}
      onClick={onOpen}
      onPointerEnter={beginPreview}
      onPointerLeave={stopPreview}
      onBlur={stopPreview}
    >
      {posterUrl ? (
        <img
          ref={posterImgRef}
          className="live-thumb-poster"
          src={posterUrl}
          srcSet={!srcsetFailed ? posterSrcSet || undefined : undefined}
          sizes={!srcsetFailed ? posterSizes : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={handlePosterLoad}
          onError={handlePosterError}
        />
      ) : (
        <span className="live-thumb-placeholder" aria-hidden="true">
          <ImageIcon size={18} />
          <span>Portada pendiente</span>
        </span>
      )}
      {previewActive ? (
        <img
          className={`live-thumb-preview ${previewLoaded ? "is-loaded" : ""}`}
          src={resources.previewUrl}
          alt=""
          decoding="async"
          draggable="false"
          style={{ "--live-preview-frame": previewFrame }}
          onLoad={() => setPreviewLoaded(true)}
          onError={() => {
            setPreviewUnavailable(true);
            stopPreview();
          }}
        />
      ) : null}
    </button>
  );
}

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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, searchTerm) {
  const value = String(text || "");
  const query = String(searchTerm || "").trim();

  if (!query) {
    return value;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  return value.split(pattern).map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="search-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDisplayDate(value) {
  const [day, month, year] = String(value || "").split("/");
  const date = new Date(`${year}-${month}-${day}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function truncateCompactTitle(value, maxLength = 46) {
  const title = String(value || "Sin titulo").replace(/\s+/g, " ").trim();

  if (title.length <= maxLength) {
    return title;
  }

  const slice = title.slice(0, maxLength + 1);
  const wordBoundary = slice.lastIndexOf(" ");
  const cutIndex = wordBoundary >= Math.floor(maxLength * 0.65) ? wordBoundary : maxLength;
  const truncated = title.slice(0, cutIndex).replace(/[\s.,;:!?\-]+$/g, "");

  return `${truncated}...`;
}

function LiveCard({
  live,
  cardDensity = "comfortable",
  isAdmin,
  canNotify = false,
  activity = null,
  isAuthenticated = false,
  onEdit,
  onNotify,
  onFilterTag,
  onFilterYear,
  onFilterStatus,
  onOpenDetail,
  onToggleSaved,
  onToggleWatched,
  onLoginRequired,
  searchTerm,
}) {
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  // Estimacion en SSR/primer render para que "Ver mas" salga sin esperar la
  // medicion del useEffect (solo en comoda, que es donde se recorta a 2 lineas).
  // El observer de abajo corrige el borde tras medir el DOM real.
  const [isInfoTruncated, setIsInfoTruncated] = useState(
    () =>
      cardDensity === "comfortable" &&
      String(live.additional_info || "").replace(/\s+/g, " ").trim().length > 110,
  );
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const adminMenuRef = useRef(null);
  const infoPreviewRef = useRef(null);
  const allTags = Array.isArray(live.tags) ? live.tags : [];
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 4);
  const hiddenCount = Math.max(allTags.length - visibleTags.length, 0);
  const okruCount = Array.isArray(live.links?.okru) ? live.links.okru.length : 0;
  const telegramCount = Array.isArray(live.links?.telegram) ? live.links.telegram.length : 0;
  const pieroCount = Array.isArray(live.links?.piero) ? live.links.piero.length : 0;
  const patreonCount = Array.isArray(live.links?.patreon) ? live.links.patreon.length : 0;
  const hasPlayerLinks = pieroCount > 0 || okruCount > 0;
  const hasAnyLinks = hasPlayerLinks || telegramCount > 0 || patreonCount > 0;
  const detailCtaLabel = hasPlayerLinks ? "Ver resubido" : hasAnyLinks ? "Ver links" : "Ver ficha";
  const DetailIcon = hasPlayerLinks ? CirclePlay : hasAnyLinks ? Link2 : FileText;
  const detailPath = `/rastreador/${encodeURIComponent(live.id)}`;
  const infoPreview = String(live.additional_info || "").replace(/\s+/g, " ").trim();
  const posterResources = getLivePosterResources(live);
  const showThumbnail = true;
  const isSaved = Boolean(activity?.isSaved);
  const isWatched = Boolean(activity?.isWatched);
  const actionIconCount = 2 + (canNotify ? 1 : 0) + (isAdmin ? 1 : 0);
  const compactTags = allTags.slice(0, 2);
  const compactHiddenCount = Math.max(allTags.length - compactTags.length, 0);
  const compactTitle = truncateCompactTitle(live.title);
  const statusMeta = getLiveStatusMeta(live.status);
  const isComfortable = cardDensity === "comfortable";
  const isTable = cardDensity === "table";
  const hasAdminActions = canNotify || isAdmin;
  const usesAdminMenu = isComfortable;
  const renderedTags = isTable ? allTags : visibleTags;
  const renderedHiddenCount = isTable ? 0 : hiddenCount;

  useEffect(() => {
    if (!showAdminMenu) return undefined;

    function closeOnPointerDown(event) {
      if (!adminMenuRef.current?.contains(event.target)) setShowAdminMenu(false);
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setShowAdminMenu(false);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAdminMenu]);

  useEffect(() => {
    const element = infoPreviewRef.current;
    if (!element || showInfo) return undefined;

    function updateTruncation() {
      setIsInfoTruncated(element.scrollHeight > element.clientHeight + 1);
    }

    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cardDensity, infoPreview, showInfo]);

  function openDetail() {
    onOpenDetail?.(live.id);
    router.push(detailPath);
  }

  if (cardDensity === "compact") {
    return (
      <article className="live-card live-card-compact visible" data-live-id={live.id}>
        <div className="live-compact-header">
          <button
            type="button"
            className="live-date-pill"
            onClick={(event) => {
              event.stopPropagation();
              onFilterYear?.(live.year);
            }}
          >
            {formatDisplayDate(live.date)}
          </button>
          <button
            type="button"
            className={statusMeta.badgeFullClassName}
            onClick={(event) => {
              event.stopPropagation();
              onFilterStatus?.(live.status);
            }}
          >
            <span className={statusMeta.dotClassName} aria-hidden="true" />
            {live.status || PENDING_LIVE_STATUS_LABEL}
          </button>
        </div>

        <h2 className="live-title live-compact-title" title={live.title || "Sin titulo"}>
          {compactTitle}
        </h2>

        <div className="live-compact-tags">
          {compactTags.map((tag) => (
            <button
              type="button"
              key={tag}
              className="tag-pill"
              onClick={(event) => {
                event.stopPropagation();
                onFilterTag(tag);
              }}
            >
              {highlightText(tag, searchTerm)}
            </button>
          ))}
          {compactHiddenCount ? <span className="tag-pill tag-pill-muted">+{compactHiddenCount}</span> : null}
        </div>

        <div className="availability-row live-compact-availability" aria-label="Disponibilidad del resubido">
          {pieroCount > 0 ? <span className="availability-chip availability-chip-piero">Piero · {pieroCount}</span> : null}
          {okruCount > 0 ? <span className="availability-chip availability-chip-okru">OK.RU · {okruCount}</span> : null}
          {telegramCount > 0 ? <span className="availability-chip availability-chip-telegram">Telegram · {telegramCount}</span> : null}
          {patreonCount > 0 ? <span className="availability-chip availability-chip-patreon">Patreon · {patreonCount}</span> : null}
          {!hasAnyLinks ? <span className="availability-chip availability-chip-muted">Sin links</span> : null}
        </div>

        <div className="links-container live-compact-actions">
          <Tooltip label={isSaved ? "Quitar de guardados" : "Guardar para después"}>
            <button
              type="button"
              className={`platform-btn platform-personal ${isSaved ? "is-active" : ""}`}
              aria-label={isSaved ? `Quitar ${live.title || "directo"} de guardados` : `Guardar ${live.title || "directo"} para después`}
              onClick={(event) => {
                event.stopPropagation();
                if (!isAuthenticated) {
                  onLoginRequired?.("Inicia sesión para guardar directos y verlos después.");
                  return;
                }

                onToggleSaved?.(live.id, !isSaved);
              }}
            >
              <Bookmark size={15} />
            </button>
          </Tooltip>
          <Tooltip label={isWatched ? "Marcar como no visto" : "Marcar como visto"}>
            <button
              type="button"
              className={`platform-btn platform-personal platform-personal-watched ${isWatched ? "is-active" : ""}`}
              aria-label={isWatched ? `Marcar ${live.title || "directo"} como no visto` : `Marcar ${live.title || "directo"} como visto`}
              onClick={(event) => {
                event.stopPropagation();
                if (!isAuthenticated) {
                  onLoginRequired?.("Inicia sesión para marcar directos como vistos.");
                  return;
                }

                onToggleWatched?.(live.id, !isWatched);
              }}
            >
              <CheckCircle2 size={15} />
            </button>
          </Tooltip>
          <Tooltip label={detailCtaLabel}>
            <button
              type="button"
              className="platform-btn platform-detail"
              aria-label={detailCtaLabel}
              onClick={(event) => {
                event.stopPropagation();
                openDetail();
              }}
            >
              <span>{detailCtaLabel}</span>
              <DetailIcon size={15} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`live-card visible ${isAdmin ? "is-admin" : ""} ${showThumbnail ? "has-thumb" : ""}`}
      data-live-id={live.id}
    >
      {showThumbnail ? (
        isComfortable ? (
          <div className="live-poster-shell">
            <LivePoster live={live} resources={posterResources} onOpen={openDetail} interactive />
            <button
              type="button"
              className={`${statusMeta.badgeFullClassName} live-poster-status`}
              onClick={(event) => {
                event.stopPropagation();
                onFilterStatus?.(live.status);
              }}
            >
              <span className={statusMeta.dotClassName} aria-hidden="true" />
              {live.status || PENDING_LIVE_STATUS_LABEL}
            </button>
            <button
              type="button"
              className="live-date-pill live-poster-date"
              onClick={(event) => {
                event.stopPropagation();
                onFilterYear?.(live.year);
              }}
            >
              {formatDisplayDate(live.date)}
            </button>
          </div>
        ) : (
          <LivePoster live={live} resources={posterResources} onOpen={openDetail} interactive={false} />
        )
      ) : null}

      <div className="live-content">
        {!isComfortable ? <div className="live-meta">
          <button
            type="button"
            className="live-date-pill"
            onClick={(event) => {
              event.stopPropagation();
              onFilterYear?.(live.year);
            }}
          >
            {formatDisplayDate(live.date)}
          </button>
          <button
            type="button"
            className={statusMeta.badgeFullClassName}
            onClick={(event) => {
              event.stopPropagation();
              onFilterStatus?.(live.status);
            }}
          >
            <span className={statusMeta.dotClassName} aria-hidden="true" />
            {live.status || PENDING_LIVE_STATUS_LABEL}
          </button>
        </div> : null}

        <h2 className="live-title" title={live.title || "Sin titulo"}>{highlightText(live.title || "Sin titulo", searchTerm)}</h2>

        {live.additional_info ? (
          <>
            <p ref={infoPreviewRef} className={`info-preview ${showInfo ? "is-expanded" : ""}`}>
              {showInfo ? renderInfoText(live.additional_info) : highlightText(infoPreview, searchTerm)}
            </p>
            {showInfo || isInfoTruncated ? <button
              type="button"
              className="info-inline-toggle"
              onClick={(event) => {
                event.stopPropagation();
                setShowInfo((current) => !current);
              }}
            >
              <span>{showInfo ? "Ver menos" : "Ver mas"}</span>
              {showInfo ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
            </button> : null}
          </>
        ) : null}

        <div className={`tags-container ${showAllTags ? "is-expanded" : ""}`}>
          {renderedTags.map((tag) => (
            <button
              type="button"
              key={tag}
              className="tag-pill"
              onClick={(event) => {
                event.stopPropagation();
                onFilterTag(tag);
              }}
            >
              {highlightText(tag, searchTerm)}
            </button>
          ))}
          {renderedHiddenCount ? (
            isTable ? (
              <Tooltip label={allTags.slice(2).join(", ")}>
                <span className="tag-pill tag-pill-muted">+{renderedHiddenCount}</span>
              </Tooltip>
            ) : (
            <button
              type="button"
              className="tag-pill tag-pill-muted"
              onClick={(event) => {
                event.stopPropagation();
                setShowAllTags(true);
              }}
            >
              +{renderedHiddenCount}
            </button>
            )
          ) : null}
          {!isTable && showAllTags && allTags.length > 4 ? (
            <button
              type="button"
              className="tag-pill tag-pill-muted"
              onClick={(event) => {
                event.stopPropagation();
                setShowAllTags(false);
              }}
            >
              Ver menos
            </button>
          ) : null}
        </div>

        <div className="availability-row" aria-label="Disponibilidad del resubido">
          {pieroCount > 0 ? (
            <span className="availability-chip availability-chip-piero">
              Piero · {pluralize(pieroCount, "parte", "partes")}
            </span>
          ) : null}
          {okruCount > 0 ? (
            <span className="availability-chip availability-chip-okru">
              OK.RU · {pluralize(okruCount, "parte", "partes")}
            </span>
          ) : null}
          {telegramCount > 0 ? (
            <span className="availability-chip availability-chip-telegram">
              Telegram · {pluralize(telegramCount, "link", "links")}
            </span>
          ) : null}
          {patreonCount > 0 ? (
            <span className="availability-chip availability-chip-patreon">
              Patreon · {pluralize(patreonCount, "link", "links")}
            </span>
          ) : null}
          {!hasAnyLinks ? <span className="availability-chip availability-chip-muted">Sin links</span> : null}
        </div>

        <div className={`links-container has-${actionIconCount}-icon-actions ${usesAdminMenu && hasAdminActions ? "has-admin-menu" : ""}`}>
          <Tooltip label={isSaved ? "Quitar de guardados" : "Guardar para después"}>
            <button
              type="button"
              className={`platform-btn platform-personal ${isSaved ? "is-active" : ""}`}
              aria-label={isSaved ? `Quitar ${live.title || "directo"} de guardados` : `Guardar ${live.title || "directo"} para después`}
              onClick={(event) => {
                event.stopPropagation();
                if (!isAuthenticated) {
                  onLoginRequired?.("Inicia sesión para guardar directos y verlos después.");
                  return;
                }

                onToggleSaved?.(live.id, !isSaved);
              }}
            >
              <Bookmark size={15} />
              <span className="platform-personal-label">{isSaved ? "Guardado" : "Guardar"}</span>
            </button>
          </Tooltip>
          <Tooltip label={isWatched ? "Marcar como no visto" : "Marcar como visto"}>
            <button
              type="button"
              className={`platform-btn platform-personal platform-personal-watched ${isWatched ? "is-active" : ""}`}
              aria-label={isWatched ? `Marcar ${live.title || "directo"} como no visto` : `Marcar ${live.title || "directo"} como visto`}
              onClick={(event) => {
                event.stopPropagation();
                if (!isAuthenticated) {
                  onLoginRequired?.("Inicia sesión para marcar directos como vistos.");
                  return;
                }

                onToggleWatched?.(live.id, !isWatched);
              }}
            >
              <CheckCircle2 size={15} />
              <span className="platform-personal-label">Visto</span>
            </button>
          </Tooltip>
          {canNotify && !usesAdminMenu ? (
            <Tooltip label={live.notifiedAt ? "Reenviar notificación" : "Notificar resubido"}>
              <button
                type="button"
                className="platform-btn platform-notify"
                aria-label={live.notifiedAt ? `Reenviar notificación de ${live.title || "directo"}` : `Notificar que ${live.title || "directo"} está disponible`}
                onClick={(event) => {
                  event.stopPropagation();
                  onNotify?.(live);
                }}
              >
                {live.notifiedAt ? <Bell size={15} /> : <BellRing size={15} />}
              </button>
            </Tooltip>
          ) : null}
          {isAdmin && !usesAdminMenu ? (
            <Tooltip label="Editar directo">
              <button
                type="button"
                className="platform-btn platform-edit"
                aria-label={`Editar ${live.title || "directo"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit?.(live);
                }}
              >
                <Edit3 size={15} />
              </button>
            </Tooltip>
          ) : null}
          <Tooltip label={detailCtaLabel}>
            <button
              type="button"
              className="platform-btn platform-detail"
              aria-label={detailCtaLabel}
              onClick={(event) => {
                event.stopPropagation();
                openDetail();
              }}
            >
              <span>{detailCtaLabel}</span>
              <DetailIcon size={15} aria-hidden="true" />
            </button>
          </Tooltip>
          {usesAdminMenu && hasAdminActions ? (
            <div className="live-admin-menu" ref={adminMenuRef}>
              <Tooltip label="Más acciones">
                <button
                  type="button"
                  className={`platform-btn live-admin-menu-trigger ${showAdminMenu ? "is-active" : ""}`}
                  aria-label={`Más acciones para ${live.title || "directo"}`}
                  aria-haspopup="menu"
                  aria-expanded={showAdminMenu}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowAdminMenu((current) => !current);
                  }}
                >
                  <MoreVertical size={18} aria-hidden="true" />
                </button>
              </Tooltip>
              {showAdminMenu ? (
                <div className="live-admin-menu-popover" role="menu">
                  {canNotify ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowAdminMenu(false);
                        onNotify?.(live);
                      }}
                    >
                      {live.notifiedAt ? <Bell size={16} /> : <BellRing size={16} />}
                      <span>{live.notifiedAt ? "Reenviar notificación" : "Notificar resubido"}</span>
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowAdminMenu(false);
                        onEdit?.(live);
                      }}
                    >
                      <Edit3 size={16} />
                      <span>Editar directo</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default memo(LiveCard);
