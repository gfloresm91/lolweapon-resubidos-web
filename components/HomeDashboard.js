"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ChevronDown, CirclePlay, FileText, Info, Link2, MessageSquare, X } from "lucide-react";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";
import TwitchCompanionPlayer from "@/components/TwitchCompanionPlayer";

const DEFAULT_VK_LIVE_EMBED_URL = "https://live.vkvideo.ru/app/embed/redbreake";
const VK_LIVE_EMBED_URL = process.env.NEXT_PUBLIC_VK_LIVE_EMBED_URL || DEFAULT_VK_LIVE_EMBED_URL;
const IS_VK_MULTISTREAM_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VK_MULTISTREAM !== "false";

function parseDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function formatYoutubeDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function RecentLiveCard({ live }) {
  const okruCount = Array.isArray(live.links?.okru) ? live.links.okru.length : 0;
  const telegramCount = Array.isArray(live.links?.telegram) ? live.links.telegram.length : 0;
  const pieroCount = Array.isArray(live.links?.piero) ? live.links.piero.length : 0;
  const patreonCount = Array.isArray(live.links?.patreon) ? live.links.patreon.length : 0;
  const hasPlayerLinks = pieroCount > 0 || okruCount > 0;
  const hasAnyLinks = hasPlayerLinks || telegramCount > 0 || patreonCount > 0;
  const detailCtaLabel = hasPlayerLinks ? "Ver resubido" : hasAnyLinks ? "Ver links" : "Ver ficha";
  const DetailIcon = hasPlayerLinks ? CirclePlay : hasAnyLinks ? Link2 : FileText;
  const detailPath = `/rastreador/${encodeURIComponent(live.id)}`;
  const liveStatus = live.status || PENDING_LIVE_STATUS_LABEL;

  return (
    <article className="home-live-card">
      <div className="home-live-meta">
        <span>{live.date || "Sin fecha"}</span>
        <span aria-hidden="true">·</span>
        <span>{liveStatus}</span>
      </div>
      <h3>{live.title || "Sin título"}</h3>
      <div className="home-live-tags">
        {(live.tags || []).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <a href={detailPath} className="platform-btn platform-detail home-live-detail-link">
        <span>{detailCtaLabel}</span>
        <DetailIcon size={15} aria-hidden="true" />
      </a>
    </article>
  );
}

function YoutubeCard({ video }) {
  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="youtube-card">
      <div className="youtube-thumb">
        {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <span>YT</span>}
        <div className="youtube-play-overlay" aria-hidden="true" />
      </div>
      <div className="youtube-card-body">
        <span>Publicado · {formatYoutubeDate(video.publishedAt)}</span>
        <h3>{video.title}</h3>
      </div>
    </a>
  );
}

export default function HomeDashboard({
  lives,
  youtubeVideos,
  twitchStream,
  twitchProfile,
  twitchChannelInfo,
  twitchGame,
  twitchLogin,
  youtubeChannelUrl,
  streamlabsUrl,
  onTrackerOpen,
  mode = "full",
}) {
  const [currentStream, setCurrentStream] = useState(twitchStream);
  const [currentProfile, setCurrentProfile] = useState(twitchProfile);
  const [currentChannelInfo, setCurrentChannelInfo] = useState(twitchChannelInfo);
  const [currentGame, setCurrentGame] = useState(twitchGame);
  const [isTwitchLoading, setIsTwitchLoading] = useState(!twitchChannelInfo && !twitchStream);
  const [videos, setVideos] = useState(youtubeVideos || []);
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(!(youtubeVideos || []).length);
  const [twitchParent, setTwitchParent] = useState("");
  const [streamMode, setStreamMode] = useState("twitch");
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isMobileTheaterLayout, setIsMobileTheaterLayout] = useState(false);
  const [isTwitchChatTheaterEligible, setIsTwitchChatTheaterEligible] = useState(false);
  const [isTwitchChatTheaterOpen, setIsTwitchChatTheaterOpen] = useState(false);
  const [isStreamInfoOpen, setIsStreamInfoOpen] = useState(false);
  const [twitchPlaybackState, setTwitchPlaybackState] = useState("loading");
  const twitchChannel = twitchLogin || process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN || "kalathraslolweapon";
  const isOnline = Boolean(currentStream);
  const isDualMode = IS_VK_MULTISTREAM_ENABLED && streamMode === "dual";
  const isTwitchChatTheater = !isDualMode && isTwitchChatTheaterOpen;

  useEffect(() => {
    setTwitchParent(window.location.hostname);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const updateEligibility = () => {
      setIsTwitchChatTheaterEligible(mediaQuery.matches);
      if (!mediaQuery.matches) setIsTwitchChatTheaterOpen(false);
    };
    updateEligibility();
    mediaQuery.addEventListener("change", updateEligibility);
    return () => mediaQuery.removeEventListener("change", updateEligibility);
  }, []);

  useEffect(() => {
    // Compact dual theater is shared by mobile, tablet and small laptops.
    // Wide desktop keeps the permanent two-column arrangement.
    const mediaQuery = window.matchMedia("(max-width: 1200px)");
    const updateLayout = () => setIsMobileTheaterLayout(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (!IS_VK_MULTISTREAM_ENABLED) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stream") === "dual") {
      window.dispatchEvent(new CustomEvent("kala:twitch-play-request", { detail: { muted: true, source: "dual-mode" } }));
      setStreamMode("dual");
    }
  }, []);

  useEffect(() => {
    const notifyAnchorChange = () => {
      window.dispatchEvent(new CustomEvent("kala:twitch-anchor-change", { detail: { mode: streamMode } }));
    };
    notifyAnchorChange();
    const frame = window.requestAnimationFrame(notifyAnchorChange);
    const settleTimer = window.setTimeout(notifyAnchorChange, 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [isMobileTheaterLayout, streamMode]);

  useEffect(() => {
    function handlePlaybackState(event) {
      if (event.detail?.state) setTwitchPlaybackState(event.detail.state);
    }

    window.addEventListener("kala:twitch-playback-state", handlePlaybackState);
    return () => window.removeEventListener("kala:twitch-playback-state", handlePlaybackState);
  }, []);

  useEffect(() => {
    if (!isDualMode) {
      setIsChatCollapsed(false);
      setIsChatExpanded(false);
      setIsStreamInfoOpen(false);
    }
  }, [isDualMode]);

  useEffect(() => {
    if (isDualMode) setIsTwitchChatTheaterOpen(false);
  }, [isDualMode]);

  useEffect(() => {
    if (isDualMode && !isChatExpanded) {
      // The companion sits underneath the expanded chat overlay; nudge it to
      // resume in case it lost autoplay while covered.
      window.dispatchEvent(new CustomEvent("kala:twitch-play-request", { detail: { muted: true, source: "chat-collapsed" } }));
    }
  }, [isChatExpanded, isDualMode]);

  useEffect(() => {
    if (!isDualMode) return undefined;
    const previousScrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.classList.add("is-dual-theater-open");
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = "100%";

    const alignmentFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("kala:twitch-anchor-change", { detail: { mode: "dual" } }));
      });
    });

    return () => {
      window.cancelAnimationFrame(alignmentFrame);
      document.body.classList.remove("is-dual-theater-open");
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.requestAnimationFrame(() => window.scrollTo({ top: previousScrollY, behavior: "instant" }));
    };
  }, [isDualMode]);

  useEffect(() => {
    if (!isTwitchChatTheater) return undefined;
    const previousScrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.classList.add("is-twitch-chat-theater-open");
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.classList.remove("is-twitch-chat-theater-open");
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.requestAnimationFrame(() => window.scrollTo({ top: previousScrollY, behavior: "instant" }));
    };
  }, [isTwitchChatTheater]);

  useEffect(() => {
    if (!isDualMode && !isTwitchChatTheater && !isStreamInfoOpen) return undefined;

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      if (isStreamInfoOpen) setIsStreamInfoOpen(false);
      else if (isDualMode) setStreamMode("twitch");
      else if (isTwitchChatTheater) setIsTwitchChatTheaterOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isDualMode, isStreamInfoOpen, isTwitchChatTheater]);

  function activateDualMode() {
    window.dispatchEvent(new CustomEvent("kala:twitch-play-request", { detail: { muted: true, source: "dual-mode" } }));
    setStreamMode("dual");
  }

  function retryTwitchPlayback() {
    window.dispatchEvent(new CustomEvent("kala:twitch-play-request", { detail: { muted: true, source: "blocked-retry" } }));
  }

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      if (document.hidden) return;

      try {
        const response = await fetch("/api/twitch/status", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setCurrentStream(data.stream || null);
          setCurrentProfile(data.profile || null);
          setCurrentChannelInfo(data.channelInfo || null);
          setCurrentGame(data.game || null);
          setIsTwitchLoading(false);
        }
      } catch {
        if (isMounted) {
          setCurrentStream(null);
          setIsTwitchLoading(false);
        }
      }
    }

    if (!twitchChannelInfo && !twitchStream) {
      refreshStatus();
    }

    const intervalId = window.setInterval(refreshStatus, 60000);

    function handleVisibilityChange() {
      if (!document.hidden) {
        refreshStatus();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadYoutubeVideos() {
      try {
        const response = await fetch("/api/youtube/videos", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setVideos(data.videos || []);
        }
      } finally {
        if (isMounted) {
          setIsYoutubeLoading(false);
        }
      }
    }

    if (!(youtubeVideos || []).length) {
      loadYoutubeVideos();
    }

    return () => {
      isMounted = false;
    };
  }, [youtubeVideos]);

  const recentLives = useMemo(() => {
    return [...lives]
      .sort((left, right) => parseDate(right.date).localeCompare(parseDate(left.date)))
      .slice(0, 10);
  }, [lives]);
  const channelName = currentProfile?.display_name || twitchChannel;
  const channelDescription = currentProfile?.description || "";
  const currentTitle = currentStream?.title || currentChannelInfo?.title || "Sin título configurado";
  const currentCategory = currentStream?.game_name || currentChannelInfo?.game_name || "";
  const categoryImage = currentGame?.box_art_url
    ? currentGame.box_art_url.replace("{width}", "96").replace("{height}", "128")
    : "";
  const twitchChatUrl = twitchParent
    ? `https://www.twitch.tv/embed/${encodeURIComponent(twitchChannel)}/chat?parent=${encodeURIComponent(twitchParent)}&darkpopout`
    : "";
  const twitchPlaybackLabel = !isOnline
    ? "Offline"
    : twitchPlaybackState === "blocked"
      ? "Activar Twitch"
    : twitchPlaybackState === "playing"
      ? "Reproduciendo"
      : "Reanudando";
  const dashboardClassName = [
    "home-dashboard",
    mode === "mini" ? "is-mini-player" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const streamDetailsBlock = (
    <div className="stream-details">
      <div className="stream-avatar">
        {currentProfile?.profile_image_url ? (
          <img src={currentProfile.profile_image_url} alt="" />
        ) : (
          "LW"
        )}
      </div>
      <div className="stream-details-copy">
        <h2 aria-live="polite" aria-busy={isTwitchLoading}>
          {isTwitchLoading
            ? <span className="stream-title-skeleton" aria-hidden="true" />
            : currentTitle}
        </h2>
        <div className="stream-details-meta">
          <span>{channelName}</span>
          {!isTwitchLoading ? (
            <span className={`stream-status-label ${isOnline ? "is-online" : "is-offline"}`}>
              {isOnline ? "En directo" : "Offline"}
            </span>
          ) : null}
          {isOnline && typeof currentStream.viewer_count === "number" ? (
            <span>{currentStream.viewer_count.toLocaleString("es-CL")} espectadores en Twitch</span>
          ) : null}
        </div>
        {currentCategory ? (
          <div className="stream-category-line">
            {categoryImage ? <img src={categoryImage} alt="" /> : null}
            <span>{currentCategory}</span>
          </div>
        ) : null}
        {!isOnline && channelDescription ? (
          <p className="stream-details-description">{channelDescription}</p>
        ) : null}
      </div>
      <div className="stream-actions">
        <a
          href={`https://www.twitch.tv/${twitchChannel}`}
          target="_blank"
          rel="noreferrer"
          className="home-twitch-link"
        >
          Apoyar en Twitch
        </a>
        <a
          href={streamlabsUrl || "https://streamlabs.com/kalathraslolweapon/tip"}
          target="_blank"
          rel="noreferrer"
          className="stream-tip-button"
        >
          <span className="paypal-icon" aria-hidden="true">P</span>
          Apoyar por PayPal
        </a>
      </div>
    </div>
  );

  const chatToggleButton = (
    <button
      type="button"
      className="stream-chat-toggle"
      aria-expanded={isDualMode ? isChatExpanded : !isChatCollapsed}
      onClick={() => (
        isDualMode
          ? setIsChatExpanded((value) => !value)
          : setIsChatCollapsed((value) => !value)
      )}
    >
      {isDualMode
        ? (isChatExpanded ? "Ocultar chat" : "Mostrar chat")
        : (isChatCollapsed ? "Mostrar chat" : "Ocultar chat")}
      <ChevronDown aria-hidden="true" />
    </button>
  );

  const twitchCompanionBlock = isDualMode ? (
    <div className="stream-twitch-companion-wrap">
      <div className="stream-companion-heading">
        <strong>Twitch</strong>
        {twitchPlaybackState === "blocked" && isOnline ? (
          <button type="button" className="stream-playback-retry" onClick={retryTwitchPlayback}>
            <span className="stream-playback-state is-blocked">{twitchPlaybackLabel}</span>
          </button>
        ) : (
          <span className={`stream-playback-state is-${twitchPlaybackState}`}>{twitchPlaybackLabel}</span>
        )}
      </div>
      <TwitchCompanionPlayer channel={twitchChannel} parent={twitchParent} />
    </div>
  ) : null;

  const twitchChatBlock = (
    <div className={`stream-frame stream-chat ${isChatCollapsed ? "is-collapsed" : ""} ${isChatExpanded ? "is-expanded" : ""}`}>
      {twitchChatUrl ? (
        <iframe
          src={twitchChatUrl}
          title="Chat de Twitch"
          width="100%"
          height="100%"
        />
      ) : null}
    </div>
  );

  const twitchTheaterChatPortal = isTwitchChatTheater && twitchChatUrl
    ? createPortal(
      <iframe
        className="stream-chat-portal"
        id="twitch-theater-chat-portal"
        src={twitchChatUrl}
        title="Chat de Twitch"
        width="100%"
        height="100%"
      />,
      document.body,
    )
    : null;

  return (
    <main className={dashboardClassName}>
      <section className="home-section home-stream-section" aria-label="Transmisión en directo">
        <div
          className={`stream-block ${isDualMode ? "is-dual-theater" : ""} ${isTwitchChatTheater ? "is-twitch-chat-theater" : ""} ${!isDualMode && isMobileTheaterLayout ? "is-twitch-compact" : ""} ${!isDualMode && isTwitchChatTheaterEligible && !isTwitchChatTheater ? "has-twitch-chat-cta" : ""} ${isStreamInfoOpen ? "has-info-open" : ""} ${isDualMode && isChatExpanded ? "is-chat-expanded" : ""}`}
          role={isDualMode || isTwitchChatTheater ? "dialog" : undefined}
          aria-modal={isDualMode || isTwitchChatTheater ? "true" : undefined}
          aria-label={isDualMode ? "Modo dual VK y Twitch" : isTwitchChatTheater ? "Twitch con chat" : undefined}
          aria-owns={isTwitchChatTheater ? "twitch-theater-chat-portal" : undefined}
        >
          {isDualMode ? (
            <div className="stream-theater-bar">
              <strong>VK + Twitch</strong>
              <div className="stream-theater-actions">
                {isMobileTheaterLayout ? (
                  <button type="button" onClick={() => setIsStreamInfoOpen(true)} aria-label="Información del directo">
                    <Info aria-hidden="true" />
                    <span>Información</span>
                  </button>
                ) : null}
                <button type="button" onClick={() => setStreamMode("twitch")} aria-label="Salir del modo dual">
                  <X aria-hidden="true" />
                  <span>Salir del modo dual</span>
                </button>
              </div>
            </div>
          ) : isTwitchChatTheater ? (
            <div className="stream-theater-bar stream-twitch-chat-theater-bar">
              <strong>Twitch con chat</strong>
              <div className="stream-theater-actions">
                <button type="button" onClick={() => setIsStreamInfoOpen(true)} aria-label="Información del directo">
                  <Info aria-hidden="true" />
                  <span>Información</span>
                </button>
                <button type="button" onClick={() => setIsTwitchChatTheaterOpen(false)} aria-label="Salir del modo chat">
                  <X aria-hidden="true" />
                  <span>Salir del modo chat</span>
                </button>
              </div>
            </div>
          ) : IS_VK_MULTISTREAM_ENABLED ? (
            <div className="stream-source-toolbar">
              <div className="stream-source-switch" role="group" aria-label="Fuente de la transmisión">
                <button
                  type="button"
                  className={streamMode === "twitch" ? "is-active" : ""}
                  aria-pressed={streamMode === "twitch"}
                  onClick={() => setStreamMode("twitch")}
                >
                  Twitch
                </button>
                <button type="button" aria-pressed="false" onClick={activateDualMode}>
                  VK + Twitch
                </button>
              </div>
              <div className="stream-source-actions">
                {isMobileTheaterLayout ? (
                  <button
                    type="button"
                    className="stream-info-trigger"
                    onClick={() => setIsStreamInfoOpen(true)}
                    aria-label="Información del directo"
                  >
                    <Info aria-hidden="true" />
                    <span>Información</span>
                  </button>
                ) : null}
                {!isTwitchChatTheaterEligible ? (
                  <button
                    type="button"
                    className="stream-info-trigger stream-desktop-theater-trigger"
                    onClick={() => setIsTwitchChatTheaterOpen(true)}
                    aria-label="Abrir modo teatro"
                  >
                    <MessageSquare aria-hidden="true" />
                    <span>Modo teatro</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={`stream-layout ${isDualMode ? "is-dual" : "is-twitch"}`}>
            <div className="stream-main-column">
              {isDualMode ? (
                <div className="stream-vk-wrap">
                  <div className="stream-platform-heading">
                    <strong>VK Video</strong>
                  </div>
                  <div className="stream-frame stream-player stream-vk-player">
                    <iframe
                      src={VK_LIVE_EMBED_URL}
                      allowFullScreen
                      allow="autoplay; fullscreen; picture-in-picture"
                      loading="eager"
                      referrerPolicy="strict-origin-when-cross-origin"
                      title="Directo completo en VK Video"
                      scrolling="no"
                      style={{ overflow: "hidden" }}
                    />
                  </div>
                </div>
              ) : (
                <TwitchCompanionPlayer
                  channel={twitchChannel}
                  parent={twitchParent}
                  enforcePlayback
                  respectManualPause
                  className="stream-player stream-twitch-inline-player"
                  ariaLabel="Directo de Twitch"
                />
              )}
              {isMobileTheaterLayout || isTwitchChatTheater ? null : streamDetailsBlock}
            </div>
            <div className="stream-side-column">
              {isDualMode && isMobileTheaterLayout ? (
                <>
                  {chatToggleButton}
                  {twitchChatBlock}
                  {twitchCompanionBlock}
                </>
              ) : !isTwitchChatTheater && (isDualMode || !isTwitchChatTheaterEligible) ? (
                <>
                  {twitchCompanionBlock}
                  {twitchChatBlock}
                </>
              ) : null}
            </div>
          </div>

          {!isDualMode && !isTwitchChatTheater && isTwitchChatTheaterEligible ? (
            <button
              type="button"
              className="stream-open-chat-theater"
              onClick={() => setIsTwitchChatTheaterOpen(true)}
            >
              <MessageSquare aria-hidden="true" />
              <span>
                <strong>Ver con chat</strong>
                <small>Abre Twitch y su chat en pantalla completa</small>
              </span>
            </button>
          ) : null}

          {(isMobileTheaterLayout || isTwitchChatTheater) && isStreamInfoOpen ? (
            <div className="stream-info-backdrop" role="presentation" onMouseDown={() => setIsStreamInfoOpen(false)}>
              <div
                className="stream-info-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Información del directo"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span className="stream-info-sheet-handle" aria-hidden="true" />
                <div className="stream-info-sheet-header">
                  <strong>Información del directo</strong>
                  <button type="button" onClick={() => setIsStreamInfoOpen(false)} aria-label="Cerrar información">
                    <X aria-hidden="true" />
                  </button>
                </div>
                {streamDetailsBlock}
              </div>
            </div>
          ) : null}
        </div>
        {twitchTheaterChatPortal}
      </section>

      <section className="home-section" aria-label="Últimos directos registrados">
        <div className="home-section-heading home-section-heading-with-action">
          <div>
            <span className="home-eyebrow">Archivo</span>
            <h2>Últimos directos registrados</h2>
            <p className="home-section-subtitle">Lo más reciente del archivo VOD.</p>
          </div>
          <button type="button" className="home-section-action" onClick={onTrackerOpen}>
            Ver rastreador
          </button>
        </div>

        {recentLives.length ? (
          <>
            <div className="home-live-grid">
              {recentLives.map((live) => (
                <RecentLiveCard key={live.id} live={live} />
              ))}
            </div>
            {lives.length > recentLives.length ? (
              <p className="home-section-more">
                Mostrando {recentLives.length} de {lives.length} directos.{" "}
                <button type="button" className="home-section-more-link" onClick={onTrackerOpen}>
                  Ver todos en el rastreador
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <div className="home-empty-panel">No hay directos registrados todavía.</div>
        )}
      </section>

      <section className="home-section" aria-label="Últimos videos de YouTube">
        <div className="home-section-heading home-section-heading-with-action">
          <div>
            <span className="home-eyebrow">YouTube</span>
            <h2>Últimos videos</h2>
            <p className="home-section-subtitle">Publicaciones recientes del canal.</p>
          </div>
          <a
            href={youtubeChannelUrl || "https://www.youtube.com/@Lolweapon"}
            target="_blank"
            rel="noreferrer"
            className="home-section-action"
          >
            Ir al canal
          </a>
        </div>

        {isYoutubeLoading ? (
          <div className="home-loading-panel" role="status" aria-live="polite">
            <span aria-hidden="true" />
            Cargando videos recientes de YouTube...
          </div>
        ) : videos.length ? (
          <div className="youtube-grid">
            {videos.map((video) => (
              <YoutubeCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="home-empty-panel">
            Configura `YOUTUBE_API_KEY` y `YOUTUBE_UPLOADS_PLAYLIST_ID` para mostrar los videos recientes.
          </div>
        )}
      </section>
    </main>
  );
}
