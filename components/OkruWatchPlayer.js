"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function getOkruEmbedUrl(href) {
  try {
    const url = new URL(href);

    if (!url.hostname.includes("ok.ru")) {
      return "";
    }

    const videoId = url.pathname.match(/\/video(?:embed)?\/(\d+)/)?.[1];

    if (!videoId) {
      return "";
    }

    return `https://ok.ru/videoembed/${videoId}`;
  } catch {
    return "";
  }
}

function clampPartIndex(index, total) {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable;
}

export default function OkruWatchPlayer({ links, liveId, title, telegramFallbackHref }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `kala_okru_part_${liveId || pathname}`;
  const playableLinks = useMemo(
    () =>
      (Array.isArray(links) ? links : [])
        .map((href, index) => ({
          href,
          index,
          embedUrl: getOkruEmbedUrl(href),
        }))
        .filter((item) => item.embedUrl),
    [links],
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    const requestedPart = Number(searchParams.get("parte"));
    return Number.isFinite(requestedPart) && requestedPart > 0 ? requestedPart - 1 : 0;
  });
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [copyPageLabel, setCopyPageLabel] = useState("Copiar pagina");
  const [copyPartLabel, setCopyPartLabel] = useState("Copiar parte");
  const activeLink = playableLinks[activeIndex] || null;
  const activePartLabel = activeLink ? `Parte ${activeIndex + 1}` : "";
  const activePartSummary = activeLink ? `${activePartLabel} de ${playableLinks.length}` : "Sin parte seleccionada";

  useEffect(() => {
    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        setIsTheaterMode(false);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTheaterMode((current) => !current);
      } else if (event.key === "ArrowLeft" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex - 1, playableLinks.length));
      } else if (event.key === "ArrowRight" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex + 1, playableLinks.length));
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copyPartUrl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, playableLinks.length, isTheaterMode, searchParams]);

  useEffect(() => {
    const requestedPart = Number(searchParams.get("parte"));
    let savedPart = 0;

    try {
      savedPart = Number(window.localStorage.getItem(storageKey));
    } catch {
      savedPart = 0;
    }
    const hasRequestedPart = Number.isFinite(requestedPart) && requestedPart > 0;
    const hasSavedPart = Number.isFinite(savedPart) && savedPart > 0;
    const nextIndex = hasRequestedPart ? requestedPart - 1 : hasSavedPart ? savedPart - 1 : 0;
    const clampedIndex = clampPartIndex(nextIndex, playableLinks.length);

    setActiveIndex(clampedIndex);
    setIsPlayerLoading(Boolean(playableLinks[clampedIndex]));
  }, [playableLinks, searchParams, storageKey]);

  function updateActivePart(index) {
    const params = new URLSearchParams(searchParams.toString());
    const clampedIndex = clampPartIndex(index, playableLinks.length);

    params.set("parte", String(clampedIndex + 1));
    setActiveIndex(clampedIndex);
    setIsPlayerLoading(Boolean(playableLinks[clampedIndex]));
    try {
      window.localStorage.setItem(storageKey, String(clampedIndex + 1));
    } catch {
      // Some browser privacy modes can block localStorage.
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function buildPartUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("parte", String(activeIndex + 1));
    return url.toString();
  }

  async function copyText(value, setLabel, resetLabel) {
    try {
      await navigator.clipboard.writeText(value);
      setLabel("Copiado");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    } catch {
      setLabel("No se pudo copiar");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    }
  }

  function copyPageUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("parte");
    copyText(url.toString(), setCopyPageLabel, "Copiar pagina");
  }

  function copyPartUrl() {
    copyText(buildPartUrl(), setCopyPartLabel, "Copiar parte");
  }

  return (
    <div className={`watch-player-stage ${isTheaterMode ? "is-theater" : ""}`}>
      {isTheaterMode ? (
        <button type="button" className="watch-theater-exit" onClick={() => setIsTheaterMode(false)}>
          Salir modo teatro
        </button>
      ) : null}

      <div className="watch-mini-header">
        <div>
          <span>{activePartSummary}</span>
          <strong>{title || "Resubido"}</strong>
        </div>
        <button type="button" className="watch-tool-button" onClick={() => setIsTheaterMode((current) => !current)}>
          {isTheaterMode ? "Salir modo teatro" : "Modo teatro"}
        </button>
      </div>

      <div className="watch-player-topline">
        <span>{activeLink ? `Reproduciendo ${activePartSummary}` : "Sin parte seleccionada"}</span>
        <div className="watch-player-actions">
          {activeLink ? (
            <a href={activeLink.href} target="_blank" rel="noreferrer" className="watch-tool-button">
              Abrir OK.RU
            </a>
          ) : null}
          <button type="button" className="watch-tool-button" onClick={copyPageUrl}>
            {copyPageLabel}
          </button>
          <button type="button" className="watch-tool-button" onClick={copyPartUrl}>
            {copyPartLabel}
          </button>
        </div>
      </div>

      {activeLink ? (
        <div className="watch-player-wrap">
          <iframe
            key={activeLink.embedUrl}
            src={activeLink.embedUrl}
            title={`Player OK.RU - ${title || "Resubido"} - ${activePartLabel}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setIsPlayerLoading(false)}
          />
          {isPlayerLoading ? <div className="watch-loading-overlay">Cargando parte...</div> : null}
        </div>
      ) : (
        <div className="watch-player-placeholder is-telegram-fallback">
          <span className="watch-placeholder-label">Player no disponible</span>
          <p>Este resubido no tiene un link OK.RU reproducible.</p>
          {telegramFallbackHref ? (
            <a href={telegramFallbackHref} target="_blank" rel="noreferrer" className="platform-btn platform-telegram">
              Ver en Telegram
            </a>
          ) : null}
        </div>
      )}

      <div className="watch-link-group">
        <h3>{activeLink ? `OK.RU · ${activePartSummary}` : "OK.RU"}</h3>
        {playableLinks.length ? (
          <ol className="detail-link-list">
            {playableLinks.map((item, index) => (
              <li key={`${item.href}-${index}`}>
                <button
                  type="button"
                  className={`platform-btn platform-okru ${index === activeIndex ? "is-active" : ""}`}
                  onClick={() => updateActivePart(index)}
                >
                  Parte {index + 1} de {playableLinks.length}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-empty">Sin links cargados.</p>
        )}
      </div>
    </div>
  );
}
