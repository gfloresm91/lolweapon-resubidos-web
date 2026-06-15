"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, CirclePlay, Edit3 } from "lucide-react";

import Tooltip from "@/components/Tooltip";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("directo")) return "status-badge status-badge--directo";
  if (normalized.includes("completo")) return "status-badge status-badge--completo";
  if (normalized.includes("lost")) return "status-badge status-badge--lost";
  if (normalized.includes("subiendo")) return "status-badge status-badge--subiendo";
  return "status-badge status-badge--pendiente";
}

function statusDotClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("directo")) return "status-dot status-dot-directo";
  if (normalized.includes("completo")) return "status-dot status-dot-completo";
  if (normalized.includes("lost")) return "status-dot status-dot-lost";
  if (normalized.includes("subiendo")) return "status-dot status-dot-subiendo";
  return "status-dot status-dot-pendiente";
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
  activity = null,
  isAuthenticated = false,
  onEdit,
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
  const [showAllTags, setShowAllTags] = useState(false);
  const allTags = Array.isArray(live.tags) ? live.tags : [];
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 4);
  const hiddenCount = Math.max(allTags.length - visibleTags.length, 0);
  const okruCount = Array.isArray(live.links?.okru) ? live.links.okru.length : 0;
  const telegramCount = Array.isArray(live.links?.telegram) ? live.links.telegram.length : 0;
  const hasAnyLinks = okruCount > 0 || telegramCount > 0;
  const detailCtaLabel = okruCount > 0 ? "Ver resubido" : telegramCount > 0 ? "Ver links" : "Ver ficha";
  const detailPath = `/rastreador/${encodeURIComponent(live.id)}`;
  const infoPreview = String(live.additional_info || "").replace(/\s+/g, " ").trim();
  const showThumbnail = false;
  const isSaved = Boolean(activity?.isSaved);
  const isWatched = Boolean(activity?.isWatched);
  const compactTags = allTags.slice(0, 2);
  const compactHiddenCount = Math.max(allTags.length - compactTags.length, 0);
  const compactTitle = truncateCompactTitle(live.title);

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
            className={statusClass(live.status)}
            onClick={(event) => {
              event.stopPropagation();
              onFilterStatus?.(live.status);
            }}
          >
            <span className={statusDotClass(live.status)} aria-hidden="true" />
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
          {okruCount > 0 ? <span className="availability-chip availability-chip-okru">OK.RU · {okruCount}</span> : null}
          {telegramCount > 0 ? <span className="availability-chip availability-chip-telegram">Telegram · {telegramCount}</span> : null}
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
              className={`platform-btn platform-personal ${isWatched ? "is-active" : ""}`}
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
          <button
            type="button"
            className="platform-btn platform-detail"
            onClick={(event) => {
              event.stopPropagation();
              openDetail();
            }}
          >
            <span>{detailCtaLabel}</span>
            <CirclePlay size={15} aria-hidden="true" />
          </button>
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
        <div className="live-thumb" aria-hidden="true">
          <img src={live.image} alt="" loading="lazy" />
        </div>
      ) : null}

      <div className="live-content">
        <div className="live-meta">
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
            className={statusClass(live.status)}
            onClick={(event) => {
              event.stopPropagation();
              onFilterStatus?.(live.status);
            }}
          >
            <span className={statusDotClass(live.status)} aria-hidden="true" />
            {live.status || PENDING_LIVE_STATUS_LABEL}
          </button>
        </div>

        <h2 className="live-title">{highlightText(live.title || "Sin titulo", searchTerm)}</h2>

        {(isSaved || isWatched) ? (
          <div className="live-personal-badges" aria-label="Estado personal">
            {isSaved ? <span className="live-personal-badge">Guardado</span> : null}
            {isWatched ? <span className="live-personal-badge is-watched">Visto</span> : null}
          </div>
        ) : null}

        {live.additional_info ? (
          <>
            <p className={`info-preview ${showInfo ? "is-expanded" : ""}`}>
              {showInfo ? renderInfoText(live.additional_info) : highlightText(infoPreview, searchTerm)}
            </p>
            <button
              type="button"
              className="info-inline-toggle"
              onClick={(event) => {
                event.stopPropagation();
                setShowInfo((current) => !current);
              }}
            >
              {showInfo ? "Ver menos" : "Ver mas"}
            </button>
          </>
        ) : null}

        <div className="tags-container">
          {visibleTags.map((tag) => (
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
          {hiddenCount ? (
            <button
              type="button"
              className="tag-pill tag-pill-muted"
              onClick={(event) => {
                event.stopPropagation();
                setShowAllTags(true);
              }}
            >
              +{hiddenCount}
            </button>
          ) : null}
          {showAllTags && allTags.length > 4 ? (
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
          {!hasAnyLinks ? <span className="availability-chip availability-chip-muted">Sin links</span> : null}
        </div>

        <div className="links-container">
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
              className={`platform-btn platform-personal ${isWatched ? "is-active" : ""}`}
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
          {isAdmin ? (
            <Tooltip label="Editar directo">
              <button
                type="button"
                className="platform-btn platform-edit"
                aria-label={`Editar ${live.title || "directo"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                <Edit3 size={15} />
              </button>
            </Tooltip>
          ) : null}
          <button
            type="button"
            className="platform-btn platform-detail"
            onClick={(event) => {
              event.stopPropagation();
              openDetail();
            }}
          >
            <span>{detailCtaLabel}</span>
            <CirclePlay size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(LiveCard);
