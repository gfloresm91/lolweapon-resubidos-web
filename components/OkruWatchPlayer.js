"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Play, RotateCcw, SkipForward } from "lucide-react";

const PieroVideoPlayer = dynamic(() => import("@/components/PieroVideoPlayer"), { ssr: false });

const AUTO_ADVANCE_SECONDS = 7;
const PROGRESS_EXPIRATION_MS = 90 * 24 * 60 * 60 * 1000;
const SERVER_PROGRESS_INTERVAL_SECONDS = 12;

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
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button" ||
    tagName === "a" ||
    target?.isContentEditable
  );
}

function buildSafeFilename(title, partNumber) {
  const base = String(title || "resubido")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .toLowerCase();

  return `${base || "resubido"}-parte-${partNumber}.mp4`;
}

function getSidecarSubtitleUrl(videoUrl) {
  try {
    const url = new URL(videoUrl);
    if (!/\.mp4$/i.test(url.pathname)) return "";
    url.pathname = url.pathname.replace(/\.mp4$/i, ".vtt");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function formatPlaybackTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function OkruWatchPlayer({
  okruLinks,
  pieroLinks,
  liveId,
  title,
  // isAuthenticated/dbLiveId/initialPlayback son opcionales a propósito. Cuando isAuthenticated es
  // true, el progreso de Piero (leer/guardar/borrar) usa BD exclusivamente - ni se lee ni se escribe
  // localStorage, sin fallback. localStorage solo aplica para invitados (isAuthenticated=false).
  // La página real (rastreador/[id]) pasa los 3 props para usuarios logueados. El embed mobile
  // (app/mobile-embed/watch/[id]) solo pasa isAuthenticated (sin dbLiveId/initialPlayback) cuando el
  // usuario nativo está logueado - ahí la sincronización real la hace el lado nativo (usePlaybackSync
  // + resume= en la URL), así que este componente simplemente se abstiene de tocar progreso.
  isAuthenticated = false,
  dbLiveId = null,
  initialPlayback = [],
  // Solo lo pasa el embed mobile (ver MobileEmbedPlayer.js) para reflejar el toggle nativo "Reproducción
  // automática" - cuando está definido (true o false), reemplaza por completo la lectura de
  // localStorage de más abajo. undefined = comportamiento de siempre (localStorage, página real).
  forcedAutoAdvance = undefined,
}) {
  const progressSaveRef = useRef(0);
  const videoRef = useRef(null);
  const autoplayNextRef = useRef(false);
  const completedPartRef = useRef(false);
  const hasRestoredProgressRef = useRef(false);
  const resumeNoticeTimerRef = useRef(null);
  const stalledNoticeTimerRef = useRef(null);
  const lastPlaybackActivityRef = useRef(0);
  const completionOverlayRef = useRef(null);
  const completionPrimaryActionRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const playableOkruLinks = useMemo(
    () =>
      (Array.isArray(okruLinks) ? okruLinks : [])
        .map((href, index) => ({
          href,
          index,
          embedUrl: getOkruEmbedUrl(href),
        }))
        .filter((item) => item.embedUrl),
    [okruLinks],
  );
  const playablePieroLinks = useMemo(
    () => (Array.isArray(pieroLinks) ? pieroLinks : []).filter(Boolean).map((href, index) => ({ href, index })),
    [pieroLinks],
  );
  const availableSources = useMemo(() => {
    const sources = [];
    if (playablePieroLinks.length) sources.push({ id: "piero", label: "Piero", links: playablePieroLinks });
    if (playableOkruLinks.length) sources.push({ id: "okru", label: "OK.RU", links: playableOkruLinks });
    return sources;
  }, [playableOkruLinks, playablePieroLinks]);
  const requestedSource = searchParams.get("fuente");
  const initialSource = availableSources.some((source) => source.id === requestedSource)
    ? requestedSource
    : availableSources[0]?.id || "piero";
  const [activeSourceId, setActiveSourceId] = useState(initialSource);
  const [activeIndices, setActiveIndices] = useState(() => {
    const requestedPart = Number(searchParams.get("parte"));
    return { [initialSource]: Number.isFinite(requestedPart) && requestedPart > 0 ? requestedPart - 1 : 0 };
  });
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Cargando parte...");
  const [playerError, setPlayerError] = useState(false);
  const [playerRetryKey, setPlayerRetryKey] = useState(0);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Compartir");
  const [cobaltLabel, setCobaltLabel] = useState("Copiar y abrir Cobalt");
  const [copyCommandLabel, setCopyCommandLabel] = useState("Copiar comando");
  const [copyOkruLabel, setCopyOkruLabel] = useState("Copiar link OK.RU");
  const [resumeMessage, setResumeMessage] = useState("");
  const [nextPartCountdown, setNextPartCountdown] = useState(null);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [isFinalPartComplete, setIsFinalPartComplete] = useState(false);
  const [activeSubtitleSrc, setActiveSubtitleSrc] = useState("");
  const isCompletionOverlayOpen = nextPartCountdown !== null || isFinalPartComplete;
  const activeSource = availableSources.find((source) => source.id === activeSourceId) || availableSources[0] || null;
  const activeIndex = clampPartIndex(activeIndices[activeSource?.id] || 0, activeSource?.links.length || 0);
  const activeLink = activeSource?.links[activeIndex] || null;
  const activePartLabel = activeLink ? `Parte ${activeIndex + 1}` : "";
  const activePartSummary = activeLink ? `${activePartLabel} de ${activeSource.links.length}` : "Sin parte seleccionada";
  const downloadFilename = buildSafeFilename(title, activeIndex + 1);
  const streamlinkCommand = activeLink ? `streamlink "${activeLink.href}" best -o "${downloadFilename}"` : "";
  const alternateSource = availableSources.find((source) => source.id !== activeSource?.id) || null;
  const hasNextPieroPart = activeSource?.id === "piero" && activeIndex < activeSource.links.length - 1;

  useEffect(() => {
    const controller = new AbortController();
    const candidate = activeSource?.id === "piero" ? getSidecarSubtitleUrl(activeLink?.href) : "";
    setActiveSubtitleSrc("");
    if (!candidate) return () => controller.abort();

    fetch(candidate, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (response.ok) setActiveSubtitleSrc(candidate);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [activeLink?.href, activeSource?.id]);

  function getProgressStorageKey(index = activeIndex) {
    return `kala_piero_progress_${liveId || pathname}_${index + 1}`;
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && isCompletionOverlayOpen) {
        event.preventDefault();
        dismissCompletionOverlay();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (isDownloadModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsDownloadModalOpen(false);
        }
        return;
      }

      if (event.key === "Escape") {
        setIsTheaterMode(false);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTheaterMode((current) => !current);
      } else if (event.key === "ArrowLeft" && activeSource?.id === "okru" && activeSource.links.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex - 1, activeSource.links.length));
      } else if (event.key === "ArrowRight" && activeSource?.id === "okru" && activeSource.links.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex + 1, activeSource.links.length));
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copyPartUrl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, activeSource, isTheaterMode, isDownloadModalOpen, isCompletionOverlayOpen, searchParams]);

  useEffect(() => {
    if (!isCompletionOverlayOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => completionPrimaryActionRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.requestAnimationFrame(() => videoRef.current?.focus?.());
    };
  }, [isCompletionOverlayOpen]);

  useEffect(() => {
    if (!availableSources.length) return;
    const source = availableSources.some((item) => item.id === requestedSource)
      ? requestedSource
      : availableSources[0].id;
    const requestedPart = Number(searchParams.get("parte"));
    let savedPart = 0;

    try {
      savedPart = Number(window.localStorage.getItem(`kala_${source}_part_${liveId || pathname}`));
    } catch {
      savedPart = 0;
    }
    const hasRequestedPart = Number.isFinite(requestedPart) && requestedPart > 0;
    const hasSavedPart = Number.isFinite(savedPart) && savedPart > 0;
    const nextIndex = hasRequestedPart ? requestedPart - 1 : hasSavedPart ? savedPart - 1 : 0;
    const sourceLinks = availableSources.find((item) => item.id === source)?.links || [];
    const clampedIndex = clampPartIndex(nextIndex, sourceLinks.length);

    setActiveSourceId(source);
    setActiveIndices((current) => ({ ...current, [source]: clampedIndex }));
  }, [availableSources, liveId, pathname, requestedSource, searchParams]);

  useEffect(() => {
    if (forcedAutoAdvance !== undefined) {
      setIsAutoAdvanceEnabled(forcedAutoAdvance);
      return;
    }
    try {
      setIsAutoAdvanceEnabled(window.localStorage.getItem("kala_piero_auto_advance") === "true");
    } catch {
      setIsAutoAdvanceEnabled(false);
    }
  }, [forcedAutoAdvance]);

  useEffect(() => {
    if (!activeLink) {
      setIsPlayerLoading(false);
      setPlayerError(false);
      return undefined;
    }

    setIsPlayerLoading(true);
    setPlayerError(false);
    const fallbackTimeout = window.setTimeout(() => {
      setIsPlayerLoading(false);
    }, 8000);

    return () => window.clearTimeout(fallbackTimeout);
  }, [activeLink, playerRetryKey]);

  useEffect(() => {
    if (nextPartCountdown === null) return undefined;
    if (nextPartCountdown < 0) return undefined;
    if (nextPartCountdown <= 0) {
      updateActivePart(activeIndex + 1, activeSource?.id, { autoplay: true });
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNextPartCountdown((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, nextPartCountdown]);

  // Se resetea por (fuente, índice de parte), no por href: si dos partes distintas apuntan al mismo
  // archivo (dato mal cargado - link duplicado en vez de la parte real), el cambio de índice igual
  // debe cerrar el overlay de "parte completada" y remontar el player, en vez de quedarse pegado
  // mostrando la parte anterior con el texto de la siguiente.
  useEffect(() => {
    setNextPartCountdown(null);
    setResumeMessage("");
    setIsAutoplayBlocked(false);
    setIsFinalPartComplete(false);
    completedPartRef.current = false;
    hasRestoredProgressRef.current = false;
    progressSaveRef.current = 0;
    lastPlaybackActivityRef.current = 0;
  }, [activeSourceId, activeIndex]);

  useEffect(() => {
    function saveCurrentPlayback() {
      if (activeSource?.id !== "piero" || !videoRef.current) return;
      savePieroProgress(videoRef.current.currentTime);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") saveCurrentPlayback();
    }

    window.addEventListener("pagehide", saveCurrentPlayback);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", saveCurrentPlayback);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeIndex, activeSource?.id, activeLink?.href]);

  useEffect(() => () => {
    if (resumeNoticeTimerRef.current) window.clearTimeout(resumeNoticeTimerRef.current);
    if (stalledNoticeTimerRef.current) window.clearTimeout(stalledNoticeTimerRef.current);
  }, []);

  function clearPieroLoadingState() {
    if (stalledNoticeTimerRef.current) {
      window.clearTimeout(stalledNoticeTimerRef.current);
      stalledNoticeTimerRef.current = null;
    }
    setIsPlayerLoading(false);
  }

  function handlePieroWaiting(player) {
    if (player?.paused) {
      clearPieroLoadingState();
      return;
    }
    setLoadingMessage("Almacenando búfer...");
    setIsPlayerLoading(true);
  }

  function handlePieroStalled(player) {
    if (player?.paused) {
      clearPieroLoadingState();
      return;
    }
    if (stalledNoticeTimerRef.current) window.clearTimeout(stalledNoticeTimerRef.current);
    stalledNoticeTimerRef.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) {
        setLoadingMessage("La conexión está tardando más de lo esperado...");
        setIsPlayerLoading(true);
      }
      stalledNoticeTimerRef.current = null;
    }, 1500);
  }

  function retryPlayer() {
    setPlayerError(false);
    setIsPlayerLoading(true);
    setPlayerRetryKey((current) => current + 1);
  }

  function handlePlayerError() {
    setIsPlayerLoading(false);
    setPlayerError(true);
  }

  // Progreso en BD gana siempre sobre localStorage para usuarios logueados (decisión explícita,
  // no reconciliación por timestamp) - si hay una fila sin completar para esta parte, ni siquiera
  // se mira localStorage. Invitados y la página de embed mobile (que no pasa initialPlayback) caen
  // directo al camino de localStorage de siempre, sin cambios.
  function findDbPlayback() {
    if (!isAuthenticated) return null;
    return initialPlayback.find((row) => row.source === "piero" && row.partIndex === activeIndex && !row.completed) || null;
  }

  function syncPlaybackToServer(positionSeconds, completed) {
    if (!isAuthenticated || !dbLiveId) return;
    const duration = videoRef.current?.duration;
    fetch(`/api/lives/${dbLiveId}/playback`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "piero",
        partIndex: activeIndex,
        positionSeconds: Math.floor(positionSeconds),
        durationSeconds: Number.isFinite(duration) ? Math.floor(duration) : null,
        completed,
      }),
    }).catch(() => {});
  }

  function restorePieroProgress(player) {
    if (!player || hasRestoredProgressRef.current) return;
    hasRestoredProgressRef.current = true;
    let savedTime = 0;

    if (isAuthenticated) {
      // Usuario logueado: BD es la única fuente de verdad, ni siquiera se mira localStorage como
      // respaldo (si no hay fila en BD para esta parte, savedTime queda en 0 - nunca "adivina" con
      // el último valor local, que podría ser de otro dispositivo o estar desactualizado).
      const dbRow = findDbPlayback();
      if (dbRow) savedTime = dbRow.positionSeconds;
    } else {
      try {
        const rawProgress = window.localStorage.getItem(getProgressStorageKey());
        if (rawProgress) {
          const parsedProgress = JSON.parse(rawProgress);
          if (typeof parsedProgress === "number") {
            savedTime = parsedProgress;
          } else if (
            Number.isFinite(parsedProgress?.time) &&
            Number.isFinite(parsedProgress?.updatedAt) &&
            Date.now() - parsedProgress.updatedAt <= PROGRESS_EXPIRATION_MS
          ) {
            savedTime = parsedProgress.time;
          } else {
            window.localStorage.removeItem(getProgressStorageKey());
          }
        }
      } catch {
        savedTime = 0;
      }
    }

    if (
      Number.isFinite(savedTime) &&
      savedTime >= 10 &&
      savedTime < player.duration - 1
    ) {
      player.currentTime = savedTime;
      progressSaveRef.current = savedTime;
      setResumeMessage(`Continuando desde ${formatPlaybackTime(savedTime)}`);
      if (resumeNoticeTimerRef.current) window.clearTimeout(resumeNoticeTimerRef.current);
      resumeNoticeTimerRef.current = window.setTimeout(() => setResumeMessage(""), 6000);
    }

  }

  function handlePieroCanPlay(player) {
    clearPieroLoadingState();
    restorePieroProgress(player);
    tryPieroAutoplay(player);
  }

  function handlePieroTimeUpdate(currentTime) {
    // WebKit puede emitir `stalled` aunque la reproducción siga avanzando y
    // no siempre vuelve a emitir `playing`. El progreso real invalida el aviso.
    if (Number.isFinite(currentTime) && currentTime > lastPlaybackActivityRef.current + 0.05) {
      lastPlaybackActivityRef.current = currentTime;
      clearPieroLoadingState();
    }
    if (
      !Number.isFinite(currentTime)
      || Math.abs(currentTime - progressSaveRef.current) < SERVER_PROGRESS_INTERVAL_SECONDS
    ) return;

    savePieroProgress(currentTime);
  }

  function savePieroProgress(currentTime) {
    if (!Number.isFinite(currentTime) || completedPartRef.current || !hasRestoredProgressRef.current) return;
    if (Math.floor(currentTime) === Math.floor(progressSaveRef.current)) return;
    progressSaveRef.current = currentTime;
    if (isAuthenticated) {
      syncPlaybackToServer(currentTime, false);
      return;
    }
    try {
      window.localStorage.setItem(
        getProgressStorageKey(),
        JSON.stringify({ time: Math.floor(currentTime), updatedAt: Date.now() }),
      );
    } catch {
      // Some browser privacy modes can block localStorage.
    }
  }

  function restartPieroPlayback() {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setResumeMessage("");
    if (resumeNoticeTimerRef.current) window.clearTimeout(resumeNoticeTimerRef.current);
    if (isAuthenticated) {
      syncPlaybackToServer(0, false);
      return;
    }
    try {
      window.localStorage.removeItem(getProgressStorageKey());
    } catch {
      // Some browser privacy modes can block localStorage.
    }
  }

  async function tryPieroAutoplay(video) {
    setIsPlayerLoading(false);
    if (!autoplayNextRef.current) return;
    autoplayNextRef.current = false;

    try {
      await video.play();
      setIsAutoplayBlocked(false);
    } catch {
      setIsAutoplayBlocked(true);
    }
  }

  async function playBlockedPieroPart() {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setIsAutoplayBlocked(false);
    } catch {
      setIsAutoplayBlocked(true);
    }
  }

  function handlePieroEnded() {
    completedPartRef.current = true;
    if (isAuthenticated) {
      syncPlaybackToServer(videoRef.current?.currentTime || progressSaveRef.current, true);
    } else {
      try {
        window.localStorage.removeItem(getProgressStorageKey());
      } catch {
        // Some browser privacy modes can block localStorage.
      }
    }

    if (hasNextPieroPart) {
      setNextPartCountdown(isAutoAdvanceEnabled ? AUTO_ADVANCE_SECONDS : -1);
    } else {
      setIsFinalPartComplete(true);
    }
  }

  async function replayFinalPieroPart() {
    const player = videoRef.current;
    if (!player) return;
    completedPartRef.current = false;
    setIsFinalPartComplete(false);
    player.currentTime = 0;
    try {
      await player.play();
    } catch {
      setIsAutoplayBlocked(true);
    }
  }

  function dismissCompletionOverlay() {
    setNextPartCountdown(null);
    setIsFinalPartComplete(false);
  }

  function trapCompletionOverlayFocus(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismissCompletionOverlay();
      return;
    }
    if (event.key !== "Tab") return;
    const focusableElements = Array.from(
      completionOverlayRef.current?.querySelectorAll("button:not([disabled]), a[href]") || [],
    );
    if (!focusableElements.length) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function renderPlayerOverlays() {
    return (
      <>
        {isPlayerLoading ? (
          <div className="watch-loading-overlay">
            <span className="watch-loading-spinner" aria-hidden="true" />
            <span>{loadingMessage}</span>
          </div>
        ) : null}
        {resumeMessage ? (
          <div className="watch-resume-notice" role="status">
            <span>{resumeMessage}</span>
            <button type="button" onClick={restartPieroPlayback}>
              <RotateCcw size={14} aria-hidden="true" />
              Empezar de nuevo
            </button>
          </div>
        ) : null}
        {nextPartCountdown !== null ? (
          <div
            ref={completionOverlayRef}
            className="watch-next-part-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="watch-next-part-title"
            onKeyDown={trapCompletionOverlayFocus}
          >
            <div className="watch-next-part-card">
              <span className="watch-next-part-kicker">Parte completada</span>
              <strong id="watch-next-part-title">Siguiente: Parte {activeIndex + 2}</strong>
              {nextPartCountdown >= 0 ? (
                <span>La Parte {activeIndex + 2} comenzará automáticamente en {nextPartCountdown} s</span>
              ) : (
                <span>La siguiente parte está lista.</span>
              )}
              {nextPartCountdown >= 0 ? (
                <div
                  className="watch-next-part-progress is-running"
                  role="progressbar"
                  aria-label="Tiempo para reproducir la siguiente parte"
                  aria-valuemin="0"
                  aria-valuemax={AUTO_ADVANCE_SECONDS}
                  aria-valuenow={AUTO_ADVANCE_SECONDS - nextPartCountdown}
                >
                  <span style={{ animationDuration: `${AUTO_ADVANCE_SECONDS}s` }} />
                </div>
              ) : null}
              <div className="watch-next-part-actions">
                <button
                  ref={completionPrimaryActionRef}
                  type="button"
                  onClick={() => updateActivePart(activeIndex + 1, activeSource?.id, { autoplay: true })}
                >
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                  {nextPartCountdown >= 0 ? "Reproducir ahora" : `Reproducir Parte ${activeIndex + 2}`}
                </button>
                <button type="button" className="is-secondary" onClick={dismissCompletionOverlay}>
                  Quedarme aquí
                </button>
              </div>
              {nextPartCountdown >= 0 ? (
                <button type="button" className="watch-next-disable" onClick={disableAutoAdvance}>
                  Desactivar reproducción automática
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {isFinalPartComplete ? (
          <div
            ref={completionOverlayRef}
            className="watch-next-part-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="watch-final-part-title"
            onKeyDown={trapCompletionOverlayFocus}
          >
            <div className="watch-next-part-card is-final">
              <span className="watch-next-part-kicker">Resubido completado</span>
              <strong id="watch-final-part-title">Terminaste la última parte</strong>
              <span>Puedes volver a reproducirla o quedarte aquí.</span>
              <div className="watch-next-part-actions">
                <button ref={completionPrimaryActionRef} type="button" onClick={replayFinalPieroPart}>
                  <RotateCcw size={15} aria-hidden="true" />
                  Reproducir nuevamente
                </button>
                <button type="button" className="is-secondary" onClick={dismissCompletionOverlay}>
                  Quedarme aquí
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isAutoplayBlocked ? (
          <div className="watch-autoplay-blocked" role="status">
            <span>Parte {activeIndex + 1} lista</span>
            <strong>El navegador necesita tu confirmación para continuar.</strong>
            <button type="button" onClick={playBlockedPieroPart}>
              <Play size={16} fill="currentColor" aria-hidden="true" />
              Reproducir
            </button>
          </div>
        ) : null}
        {playerError ? (
          <div className="watch-player-error" role="alert">
            <strong>No se pudo reproducir esta parte desde {activeSource.label}.</strong>
            <div className="watch-player-error-actions">
              <button type="button" onClick={retryPlayer}>Reintentar</button>
              <a href={activeLink.href} target="_blank" rel="noreferrer">Abrir archivo</a>
              {alternateSource ? (
                <button type="button" onClick={() => updateActivePart(activeIndices[alternateSource.id] || 0, alternateSource.id)}>
                  Probar {alternateSource.label}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function disableAutoAdvance() {
    setIsAutoAdvanceEnabled(false);
    setNextPartCountdown(-1);
    try {
      window.localStorage.setItem("kala_piero_auto_advance", "false");
    } catch {
      // Some browser privacy modes can block localStorage.
    }
  }

  function toggleAutoAdvance() {
    setIsAutoAdvanceEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("kala_piero_auto_advance", String(next));
      } catch {
        // Some browser privacy modes can block localStorage.
      }
      return next;
    });
  }

  function updateActivePart(index, sourceId = activeSource?.id, options = {}) {
    const source = availableSources.find((item) => item.id === sourceId);
    if (!source) return;
    const params = new URLSearchParams(searchParams.toString());
    const clampedIndex = clampPartIndex(index, source.links.length);

    autoplayNextRef.current = Boolean(options.autoplay && source.id === "piero");
    setIsAutoplayBlocked(false);

    params.set("fuente", source.id);
    params.set("parte", String(clampedIndex + 1));
    setActiveSourceId(source.id);
    setActiveIndices((current) => ({ ...current, [source.id]: clampedIndex }));
    try {
      window.localStorage.setItem(`kala_${source.id}_part_${liveId || pathname}`, String(clampedIndex + 1));
    } catch {
      // Some browser privacy modes can block localStorage.
    }

    if (window.location.pathname === pathname) {
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }
  }

  function buildPartUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("fuente", activeSource.id);
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

  function copyPartUrl() {
    copyText(buildPartUrl(), setShareLabel, "Compartir");
  }

  function copyStreamlinkCommand() {
    if (!streamlinkCommand) {
      return;
    }

    copyText(streamlinkCommand, setCopyCommandLabel, "Copiar comando");
  }

  function copyOkruUrl() {
    if (!activeLink) {
      return;
    }

    copyText(activeLink.href, setCopyOkruLabel, "Copiar link OK.RU");
  }

  async function copyOkruUrlAndOpenCobalt() {
    if (!activeLink) {
      return;
    }

    window.open("https://cobalt.tools/", "_blank", "noopener,noreferrer");

    try {
      await navigator.clipboard.writeText(activeLink.href);
      setCobaltLabel("Link copiado");
    } catch {
      setCobaltLabel("Abre Cobalt y copia manual");
    }

    window.setTimeout(() => setCobaltLabel("Copiar y abrir Cobalt"), 1800);
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
        <div className="watch-source-tabs" role="tablist" aria-label="Fuentes con reproductor">
          {availableSources.map((source) => (
            <button
              key={source.id}
              type="button"
              role="tab"
              aria-controls="resubido-player"
              aria-selected={source.id === activeSource?.id}
              className={`watch-source-tab is-${source.id} ${source.id === activeSource?.id ? "is-active" : ""}`}
              onClick={() => updateActivePart(activeIndices[source.id] || 0, source.id)}
            >
              <span>{source.label}</span>
              <span className="watch-source-count watch-source-count-full">
                · {source.links.length} {source.links.length === 1 ? "parte" : "partes"}
              </span>
              <span className="watch-source-count watch-source-count-compact">· {source.links.length}</span>
            </button>
          ))}
        </div>
      </div>

      {activeLink ? (
        <div className="watch-player-wrap" id="resubido-player">
          {activeSource.id === "piero" ? (
            <PieroVideoPlayer
              ref={videoRef}
              key={`${activeSource.id}-${activeIndex}-${playerRetryKey}`}
              src={activeLink.href}
              subtitleSrc={activeSubtitleSrc}
              title={`${title || "Resubido"} - ${activePartLabel}`}
              hideCenterButton={isCompletionOverlayOpen}
              onLoadStart={() => {
                setLoadingMessage("Conectando con Piero...");
                setIsPlayerLoading(true);
              }}
              onLoadedMetadata={() => setLoadingMessage("Preparando reproducción...")}
              onCanPlay={handlePieroCanPlay}
              onPlaying={() => {
                clearPieroLoadingState();
                setIsAutoplayBlocked(false);
              }}
              onWaiting={handlePieroWaiting}
              onStalled={handlePieroStalled}
              onTimeUpdate={handlePieroTimeUpdate}
              onPause={(player) => {
                clearPieroLoadingState();
                savePieroProgress(player?.currentTime);
              }}
              onEnded={handlePieroEnded}
              onError={handlePlayerError}
            >
              <span className="piero-fullscreen-part-label">{activePartSummary}</span>
              {renderPlayerOverlays()}
            </PieroVideoPlayer>
          ) : (
            <>
              <iframe
                key={`${activeLink.embedUrl}-${playerRetryKey}`}
                src={activeLink.embedUrl}
                title={`Player OK.RU - ${title || "Resubido"} - ${activePartLabel}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setIsPlayerLoading(false)}
                onError={handlePlayerError}
              />
              {renderPlayerOverlays()}
            </>
          )}
        </div>
      ) : (
        <div className="watch-player-placeholder">
          <span className="watch-placeholder-label">Player no disponible</span>
          <p>Este resubido no tiene links Piero u OK.RU reproducibles.</p>
        </div>
      )}

      <div className="watch-link-group">
        {activeSource?.links.length ? (
          <div className="watch-parts-toolbar">
            <ol
              className="detail-link-list watch-parts-list"
              aria-label={`Partes de ${activeSource.label}`}
              style={{ "--watch-parts-columns": Math.min(activeSource.links.length, 3) }}
            >
              {activeSource.links.map((item, index) => (
                <li key={`${item.href}-${index}`}>
                  <button
                    type="button"
                    className={`platform-btn platform-${activeSource.id} ${index === activeIndex ? "is-active" : ""}`}
                    aria-pressed={index === activeIndex}
                    onClick={() => updateActivePart(index)}
                  >
                    {index === activeIndex ? <Play className="watch-active-part-icon" size={13} fill="currentColor" aria-hidden="true" /> : null}
                    Parte {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            {activeSource.id === "piero" && activeSource.links.length > 1 ? (
              <button
                type="button"
                className={`watch-auto-advance ${isAutoAdvanceEnabled ? "is-active" : ""}`}
                role="switch"
                aria-checked={isAutoAdvanceEnabled}
                title="Al terminar una parte, intenta iniciar la siguiente"
                onClick={toggleAutoAdvance}
              >
                <SkipForward size={15} aria-hidden="true" />
                <span>Reproducción automática</span>
                <span className="watch-auto-advance-control" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="detail-empty">Sin links cargados.</p>
        )}
        {activeLink ? (
          <>
            <hr className="watch-player-actions-divider" />
            <div className="watch-link-actions watch-player-actions">
              <a
                href={activeLink.href}
                target="_blank"
                rel="noreferrer"
                className={`watch-link-action watch-link-action-open watch-link-action-${activeSource.id}`}
              >
                Abrir {activeSource.label}
              </a>
              {activeSource.id === "piero" ? (
                <a
                  href={activeLink.href}
                  download={downloadFilename}
                  target="_blank"
                  rel="noreferrer"
                  className="watch-link-action watch-link-action-download"
                >
                  Descargar Piero
                </a>
              ) : null}
              <button type="button" className="watch-link-action watch-link-action-share" onClick={copyPartUrl}>
                {shareLabel}
              </button>
              {activeSource.id === "okru" ? (
                <button
                  type="button"
                  className="watch-link-action watch-link-action-danger"
                  onClick={() => setIsDownloadModalOpen(true)}
                >
                  Opciones para descargar
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {isDownloadModalOpen && activeLink && activeSource?.id === "okru" ? (
        <div className="modal-backdrop download-modal-backdrop" onClick={() => setIsDownloadModalOpen(false)}>
          <div
            className="modal-content download-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-modal-header">
              <div>
                <span className="detail-section-kicker">Opciones de descarga</span>
                <h2 className="modal-title" id="download-modal-title">
                  Descargar este resubido
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Cerrar modal de descarga"
                onClick={() => setIsDownloadModalOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="download-modal-note">
              La descarga se hace fuera de esta web. Copiaremos el link de OK.RU para usarlo en Cobalt.
            </p>

            <div className="download-help">
              <section className="download-primary-card">
                <div className="download-step-content">
                  <span>Método recomendado · {activePartSummary}</span>
                  <h3>Usar Cobalt</h3>
                  <p>
                    Cobalt abrirá en otra pestaña. Pega ahí el link copiado para intentar descargar el archivo desde
                    tu navegador.
                  </p>
                  <div className="download-command-actions">
                    <button type="button" className="btn-modal btn-modal-primary" onClick={copyOkruUrlAndOpenCobalt}>
                      {cobaltLabel}
                    </button>
                    <button type="button" className="btn-modal btn-modal-secondary" onClick={copyOkruUrl}>
                      {copyOkruLabel}
                    </button>
                  </div>
                  <p className="download-method-note">
                    Si Cobalt no funciona, prueba el método avanzado con Streamlink. También puedes{" "}
                    <a href={activeLink.href} target="_blank" rel="noreferrer">
                      abrir la parte original en OK.RU
                    </a>
                    .
                  </p>
                </div>
              </section>

              <details className="download-advanced-details">
                <summary>Método avanzado con Streamlink</summary>
                <div className="download-help-body">
                  <p className="download-advanced-intro">
                    Este método requiere instalar herramientas en tu computador y ejecutar un comando en terminal.
                  </p>
                  <section className="download-step">
                    <span className="download-step-label">1</span>
                    <div className="download-step-content">
                      <h3>Instala Streamlink</h3>
                      <p>Streamlink es la herramienta que intentará leer el link de OK.RU y guardar el video.</p>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            Descarga el instalador oficial desde Releases de Streamlink, ejecútalo y sigue los pasos del
                            instalador.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Instala Homebrew y luego ejecuta <code>brew install streamlink</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>
                            Revisa las opciones oficiales para tu distribución. En muchas distros también puedes usar el
                            gestor de paquetes.
                          </dd>
                        </div>
                      </dl>
                      <a href="https://streamlink.github.io/install.html" target="_blank" rel="noreferrer">
                        Guía oficial de Streamlink
                      </a>
                      <a href="https://github.com/streamlink/streamlink/releases" target="_blank" rel="noreferrer">
                        Releases de Streamlink
                      </a>
                      <a href="https://brew.sh/" target="_blank" rel="noreferrer">
                        Homebrew para macOS
                      </a>
                    </div>
                  </section>

                  <section className="download-step">
                    <span className="download-step-label">2</span>
                    <div className="download-step-content">
                      <h3>Instala FFmpeg si Streamlink lo necesita</h3>
                      <p>
                        FFmpeg ayuda a guardar o unir correctamente algunos streams. Si Streamlink funciona sin errores,
                        no necesitas instalarlo de inmediato.
                      </p>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            En la página oficial, usa una build enlazada en Windows EXE Files. También puedes usar{" "}
                            <code>winget install Gyan.FFmpeg</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Ejecuta <code>brew install ffmpeg</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>
                            Usa el gestor de paquetes de tu distribución: <code>sudo apt install ffmpeg</code>,{" "}
                            <code>sudo dnf install ffmpeg</code> o <code>sudo pacman -S ffmpeg</code>.
                          </dd>
                        </div>
                      </dl>
                      <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">
                        Descargas oficiales de FFmpeg
                      </a>
                    </div>
                  </section>

                  <section className="download-step">
                    <span className="download-step-label">3</span>
                    <div className="download-step-content">
                      <h3>Abre una terminal o consola</h3>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            Abre el menú Inicio, escribe <code>PowerShell</code> y abre la app. CMD también sirve.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Abre <code>Terminal</code> desde Aplicaciones, Utilidades o buscándola con Spotlight.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>Abre la terminal de tu distribución.</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section className="download-command-card download-step">
                    <span className="download-step-label">4</span>
                    <div className="download-step-content">
                      <h3>Copia y ejecuta este comando</h3>
                      <span>Comando para {activePartSummary}</span>
                      <p>
                        Copia el comando, pégalo en la terminal y presiona Enter. No cierres la ventana hasta que la
                        descarga termine.
                      </p>
                      <code className="download-command-code">{streamlinkCommand}</code>
                      <p className="download-code-hint">
                        Si no ves el comando completo, puedes desplazarlo hacia los lados.
                      </p>
                      <div className="download-command-actions">
                        <button type="button" className="btn-modal btn-modal-primary" onClick={copyStreamlinkCommand}>
                          {copyCommandLabel}
                        </button>
                        <button type="button" className="btn-modal btn-modal-secondary" onClick={copyOkruUrl}>
                          {copyOkruLabel}
                        </button>
                      </div>
                      <div className="download-path-examples">
                        <span>Ejemplos para guardar en Descargas</span>
                        <code>macOS/Linux: -o "~/Downloads/{downloadFilename}"</code>
                        <code>Windows: -o "%USERPROFILE%\Downloads\{downloadFilename}"</code>
                      </div>
                    </div>
                  </section>

                  <section className="download-step download-notes">
                    <span className="download-step-label">Ayuda</span>
                    <div className="download-troubleshooting-list">
                      <div>
                        <h4>No reconoce Streamlink</h4>
                        <p>Cierra y vuelve a abrir la terminal. Si sigue fallando, reinstala Streamlink.</p>
                      </div>
                      <div>
                        <h4>No reconoce FFmpeg</h4>
                        <p>Instala FFmpeg, cierra la terminal y vuelve a abrirla antes de intentar de nuevo.</p>
                      </div>
                      <div>
                        <h4>Falla al guardar o unir el archivo</h4>
                        <p>Instala FFmpeg y vuelve a ejecutar el comando de Streamlink.</p>
                      </div>
                      <div>
                        <h4>Quieres comprobar la instalación</h4>
                        <p>
                          Ejecuta <code>streamlink --version</code> y <code>ffmpeg -version</code>.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setIsDownloadModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
