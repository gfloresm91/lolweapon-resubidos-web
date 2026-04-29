"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("completo")) return "status-badge status-badge--completo";
  if (normalized.includes("lost")) return "status-badge status-badge--lost";
  if (normalized.includes("subiendo")) return "status-badge status-badge--subiendo";
  return "status-badge status-badge--pendiente";
}

function statusDotClass(status) {
  const normalized = String(status || "").toLowerCase();

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

function LiveCard({
  live,
  isAdmin,
  onEdit,
  onFilterTag,
  onFilterYear,
  onFilterStatus,
  onOpenDetail,
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

  function openDetail() {
    onOpenDetail?.(live.id);
    router.push(detailPath);
  }

  return (
    <article
      className={`live-card visible ${isAdmin ? "is-admin" : ""} ${showThumbnail ? "has-thumb" : ""}`}
      data-live-id={live.id}
    >
      {isAdmin ? (
        <button
          type="button"
          className="edit-indicator"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          Editar
        </button>
      ) : null}

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
            {live.status || "Pendiente"}
          </button>
        </div>

        <h2 className="live-title">{highlightText(live.title || "Sin titulo", searchTerm)}</h2>

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
          <button
            type="button"
            className="platform-btn platform-detail"
            title="Abrir pagina del resubido"
            onClick={(event) => {
              event.stopPropagation();
              openDetail();
            }}
          >
            <span>{detailCtaLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(LiveCard);
