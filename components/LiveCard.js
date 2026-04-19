"use client";

import { memo, useState } from "react";

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("completo")) return "status-badge status-badge--completo";
  if (normalized.includes("lost")) return "status-badge status-badge--lost";
  if (normalized.includes("subiendo")) return "status-badge status-badge--subiendo";
  return "status-badge status-badge--pendiente";
}

function platformLabel(platform) {
  if (platform === "okru") return "OK.RU";
  if (platform === "piero") return "Piero";
  if (platform === "patreon") return "Patreon";
  return "Telegram";
}

function platformIcon(platform) {
  if (platform === "okru") return "🇷🇺";
  if (platform === "piero") return "🔥";
  if (platform === "patreon") return "💎";
  return "";
}

function TelegramIcon() {
  return (
    <svg
      className="platform-inline-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M21.6 4.2c.3-.2.7.1.6.5l-3 14.3c-.1.5-.7.7-1.1.5l-4.5-3.3-2.3 2.2c-.3.3-.8.1-.8-.4v-3.6l8.1-7.4c.2-.2 0-.5-.2-.4l-10 6.3-4.3-1.4c-.5-.2-.5-.9 0-1.1L21.6 4.2z"
      />
    </svg>
  );
}

function buildPlatformLinkLabel(platform, total, index) {
  const label = platformLabel(platform);
  const icon = platform === "telegram" ? <TelegramIcon /> : platformIcon(platform);
  const suffix = total <= 1 ? "" : ` ${index + 1}`;

  return (
    <>
      <span className="platform-label-icon">{icon}</span>
      <span>{`${label}${suffix}`}</span>
    </>
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

function LiveCard({ live, isAdmin, onEdit, onFilterTag }) {
  const [showInfo, setShowInfo] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const allTags = Array.isArray(live.tags) ? live.tags : [];
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 4);
  const hiddenCount = Math.max(allTags.length - visibleTags.length, 0);
  const allLinks = live.links || {};
  const platforms = ["okru", "telegram", "piero", "patreon"];

  return (
    <article className={`live-card visible ${isAdmin ? "is-admin" : ""}`} onClick={isAdmin ? onEdit : undefined}>
      {isAdmin ? <div className="edit-indicator">Editar</div> : null}

      <div className="live-content">
        <div className="live-meta">
          <span>
            {live.date || "Sin fecha"}
            {live.year ? ` · ${live.year}` : ""}
          </span>
          <span className={statusClass(live.status)}>{live.status || "Pendiente"}</span>
        </div>

        <h2 className="live-title">{live.title || "Sin titulo"}</h2>

        {live.additional_info ? (
          <>
            <button
              type="button"
              className={`info-toggle-btn ${showInfo ? "active" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setShowInfo((current) => !current);
              }}
            >
              <span className="info-icon">ℹ️</span>
              <span>Información Adicional</span>
              <svg
                className="chevron"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {showInfo ? <div className="additional-info">{renderInfoText(live.additional_info)}</div> : null}
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
              {tag}
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

        <div className="links-container">
          {platforms.some((platform) => Array.isArray(allLinks[platform]) && allLinks[platform].length > 0) ? (
            platforms.flatMap((platform) =>
              (allLinks[platform] || []).map((href, index, entries) => {
                const label = buildPlatformLinkLabel(platform, entries.length, index);

                return (
                  <a
                    key={`${platform}-${index}-${href}`}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`platform-btn platform-${platform}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {label}
                  </a>
                );
              }),
            )
          ) : (
            <span className="no-links-msg">Sin links cargados</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(LiveCard);
