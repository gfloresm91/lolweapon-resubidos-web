"use client";

import { useEffect, useMemo, useState } from "react";

import { ChevronDown, CirclePlay, FileText, Link2, X } from "lucide-react";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";

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
  const [twitchPlaybackState, setTwitchPlaybackState] = useState("loading");
  const twitchChannel = twitchLogin || process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN || "kalathraslolweapon";
  const isOnline = Boolean(currentStream);
  const isDualMode = IS_VK_MULTISTREAM_ENABLED && streamMode === "dual";

  useEffect(() => {
    setTwitchParent(window.location.hostname);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("kala:twitch-anchor-change", { detail: { mode: streamMode } }));
  }, [streamMode]);

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
    }
  }, [isDualMode]);

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

    function exitOnEscape(event) {
      if (event.key === "Escape") setStreamMode("twitch");
    }

    window.addEventListener("keydown", exitOnEscape);
    return () => {
      window.cancelAnimationFrame(alignmentFrame);
      window.removeEventListener("keydown", exitOnEscape);
      document.body.classList.remove("is-dual-theater-open");
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.requestAnimationFrame(() => window.scrollTo({ top: previousScrollY, behavior: "instant" }));
    };
  }, [isDualMode]);

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

  return (
    <main className={dashboardClassName}>
      <section className="home-section home-stream-section" aria-label="Transmisión en directo">
        <div
          className={`stream-block ${isDualMode ? "is-dual-theater" : ""}`}
          role={isDualMode ? "dialog" : undefined}
          aria-modal={isDualMode ? "true" : undefined}
          aria-label={isDualMode ? "Modo dual VK y Twitch" : undefined}
        >
          {isDualMode ? (
            <div className="stream-theater-bar">
              <strong>VK + Twitch</strong>
              <button type="button" onClick={() => setStreamMode("twitch")} autoFocus>
                <X aria-hidden="true" />
                Salir del modo dual
              </button>
            </div>
          ) : IS_VK_MULTISTREAM_ENABLED ? (
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
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="stream-frame stream-player twitch-player-anchor"
                  data-twitch-player-anchor
                  aria-label="Directo de Twitch"
                />
              )}
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
                    {!isOnline && !isTwitchLoading ? <span className="stream-offline-state">Offline</span> : null}
                  </div>
                  {isDualMode && isOnline ? (
                    <div className="stream-audience-summary" aria-label="Audiencia simultánea por plataforma">
                      <span><small>Twitch</small><strong>{currentStream.viewer_count?.toLocaleString("es-CL") ?? "—"}</strong></span>
                      <span title="VK no ofrece aún una fuente oficial configurada"><small>VK</small><strong>—</strong></span>
                      <span title="Se calculará cuando ambas plataformas entreguen datos oficiales"><small>Total</small><strong>—</strong></span>
                    </div>
                  ) : isOnline && typeof currentStream.viewer_count === "number" ? (
                    <div className="stream-audience-summary is-single">
                      <span><small>Espectadores en Twitch</small><strong>{currentStream.viewer_count.toLocaleString("es-CL")}</strong></span>
                    </div>
                  ) : null}
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
                    Abrir en Twitch
                  </a>
                  <a
                    href={streamlabsUrl || "https://streamlabs.com/kalathraslolweapon/tip"}
                    target="_blank"
                    rel="noreferrer"
                    className="stream-tip-button"
                  >
                    <span className="paypal-icon" aria-hidden="true">P</span>
                    Apoyar al canal
                  </a>
                </div>
              </div>
            </div>
            <div className="stream-side-column">
              {isDualMode ? (
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
                  <div
                    className="stream-frame stream-twitch-companion twitch-player-anchor"
                    data-twitch-player-anchor
                    aria-label="Directo de Twitch silenciado"
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="stream-chat-toggle"
                aria-expanded={!isChatCollapsed}
                onClick={() => setIsChatCollapsed((value) => !value)}
              >
                Chat de Twitch
                <ChevronDown aria-hidden="true" />
              </button>
              <div className={`stream-frame stream-chat ${isChatCollapsed ? "is-collapsed" : ""}`}>
                {twitchChatUrl ? <iframe src={twitchChatUrl} title="Chat de Twitch" /> : null}
              </div>
            </div>
          </div>
        </div>
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
