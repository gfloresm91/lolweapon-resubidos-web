"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function parseDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function formatYoutubeDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const LIVE_LINK_PLATFORMS = [
  { key: "okru", label: "OK.RU" },
  { key: "telegram", label: "Telegram" },
  { key: "piero", label: "Piero" },
  { key: "patreon", label: "Patreon" },
];

const TWITCH_EMBED_SCRIPT_URL = "https://player.twitch.tv/js/embed/v1.js";
const MINI_PLAYER_SIZE_STORAGE_KEY = "kala_twitch_mini_player_width";
const MINI_PLAYER_DEFAULT_WIDTH = 380;
const MINI_PLAYER_MIN_WIDTH = 380;
const MINI_PLAYER_MAX_WIDTH = 720;

function loadTwitchEmbedScript() {
  if (window.Twitch?.Player) {
    return Promise.resolve();
  }

  if (window.__twitchEmbedScriptPromise) {
    return window.__twitchEmbedScriptPromise;
  }

  window.__twitchEmbedScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TWITCH_EMBED_SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return window.__twitchEmbedScriptPromise;
}

function clampMiniPlayerWidth(value) {
  return Math.min(MINI_PLAYER_MAX_WIDTH, Math.max(MINI_PLAYER_MIN_WIDTH, value));
}

function buildLiveLinks(links) {
  return LIVE_LINK_PLATFORMS.flatMap((platform) => {
    const platformLinks = Array.isArray(links?.[platform.key]) ? links[platform.key] : [];

    return platformLinks.map((url, index) => ({
      key: `${platform.key}-${url}-${index}`,
      label: platformLinks.length > 1 ? `${platform.label} ${index + 1}` : platform.label,
      url,
    }));
  });
}

function RecentLiveCard({ live }) {
  const liveLinks = buildLiveLinks(live.links);

  return (
    <article className="home-live-card">
      <div className="home-live-meta">
        <span>{live.date || "Sin fecha"}</span>
        <span>{live.status || "Pendiente"}</span>
      </div>
      <h3>{live.title || "Sin titulo"}</h3>
      <div className="home-live-tags">
        {(live.tags || []).slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {liveLinks.length ? (
        <div className="home-live-links">
          {liveLinks.map((link) => (
            <a key={link.key} href={link.url} target="_blank" rel="noreferrer" className="home-live-link">
              {link.label}
            </a>
          ))}
        </div>
      ) : (
        <span className="home-live-link-state">Sin enlaces cargados</span>
      )}
    </article>
  );
}

function YoutubeCard({ video }) {
  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="youtube-card">
      <div className="youtube-thumb">
        {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <span>YT</span>}
      </div>
      <div className="youtube-card-body">
        <span>{formatYoutubeDate(video.publishedAt)}</span>
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
  onTrackerOpen,
  mode = "full",
}) {
  const [currentStream, setCurrentStream] = useState(twitchStream);
  const [currentProfile, setCurrentProfile] = useState(twitchProfile);
  const [currentChannelInfo, setCurrentChannelInfo] = useState(twitchChannelInfo);
  const [currentGame, setCurrentGame] = useState(twitchGame);
  const [isTwitchLoading, setIsTwitchLoading] = useState(true);
  const [videos, setVideos] = useState(youtubeVideos || []);
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(!(youtubeVideos || []).length);
  const [twitchParent, setTwitchParent] = useState("");
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [miniPlayerWidth, setMiniPlayerWidth] = useState(MINI_PLAYER_DEFAULT_WIDTH);
  const playerContainerRef = useRef(null);
  const twitchPlayerRef = useRef(null);
  const miniResizeStateRef = useRef(null);
  const miniResizeFrameRef = useRef(null);
  const twitchChannel = twitchLogin || "kalathraslolweapon";
  const isOnline = Boolean(currentStream);
  const isMiniMode = mode === "mini";
  const playerKey = currentStream?.id ? `online-${currentStream.id}` : "offline";

  useEffect(() => {
    setTwitchParent(window.location.hostname);

    const savedWidth = Number(window.localStorage.getItem(MINI_PLAYER_SIZE_STORAGE_KEY));

    if (Number.isFinite(savedWidth)) {
      setMiniPlayerWidth(clampMiniPlayerWidth(savedWidth));
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setIsMiniDismissed(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isMiniMode) {
      setIsMiniDismissed(false);
    }
  }, [isMiniMode]);

  useEffect(() => {
    window.localStorage.setItem(MINI_PLAYER_SIZE_STORAGE_KEY, String(miniPlayerWidth));
  }, [miniPlayerWidth]);

  useEffect(() => {
    return () => {
      if (miniResizeFrameRef.current) {
        window.cancelAnimationFrame(miniResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!twitchParent || !playerContainerRef.current) {
      return undefined;
    }

    let isCancelled = false;
    const container = playerContainerRef.current;
    container.style.opacity = "";
    container.style.pointerEvents = "";
    container.innerHTML = "";
    twitchPlayerRef.current = null;

    function tryMutedAutoplay(player) {
      try {
        player.setMuted(true);
      } catch {}

      try {
        const playResult = player.play();
        playResult?.catch?.(() => {});
      } catch {}
    }

    loadTwitchEmbedScript()
      .then(() => {
        if (isCancelled || !window.Twitch?.Player) {
          return;
        }

        const player = new window.Twitch.Player("twitch-player-embed", {
          channel: twitchChannel,
          parent: [twitchParent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });

        twitchPlayerRef.current = player;
        player.addEventListener(window.Twitch.Player.READY, () => tryMutedAutoplay(player));
        player.addEventListener(window.Twitch.Player.ONLINE, () => tryMutedAutoplay(player));

        if (isOnline) {
          window.setTimeout(() => tryMutedAutoplay(player), 400);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      container.style.opacity = "0";
      container.style.pointerEvents = "none";

      try {
        twitchPlayerRef.current?.setMuted?.(true);
        twitchPlayerRef.current?.pause?.();
      } catch {}

      if (typeof twitchPlayerRef.current?.destroy === "function") {
        twitchPlayerRef.current.destroy();
      }

      twitchPlayerRef.current = null;
      container.innerHTML = "";
    };
  }, [playerKey, twitchChannel, twitchParent]);

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
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

    refreshStatus();
    const intervalId = window.setInterval(refreshStatus, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
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
  const streamStatusClass = isTwitchLoading ? "is-loading" : isOnline ? "is-online" : "is-offline";
  const dashboardClassName = [
    "home-dashboard",
    isMiniMode ? "is-mini-player" : "",
    isMiniMode && (!isOnline || isMiniDismissed) ? "is-mini-hidden" : "",
    isMiniDismissed ? "is-mini-dismissed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const miniPlayerStyle = isMiniMode
    ? { "--mini-player-width": `${miniPlayerWidth}px` }
    : undefined;

  function startMiniResize(event) {
    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture?.(event.pointerId);
    miniResizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: miniPlayerWidth,
    };
  }

  function resizeMiniPlayer(event) {
    const resizeState = miniResizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const nextWidth = clampMiniPlayerWidth(resizeState.startWidth + (resizeState.startX - event.clientX));

    if (miniResizeFrameRef.current) {
      window.cancelAnimationFrame(miniResizeFrameRef.current);
    }

    miniResizeFrameRef.current = window.requestAnimationFrame(() => {
      setMiniPlayerWidth(nextWidth);
      miniResizeFrameRef.current = null;
    });
  }

  function stopMiniResize(event) {
    if (miniResizeStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    miniResizeStateRef.current = null;
  }

  return (
    <main className={dashboardClassName} style={miniPlayerStyle}>
      <section className="home-hero">
        <div>
          <span className={`stream-status-pill ${streamStatusClass}`}>
            <span />
            {isTwitchLoading ? "Consultando" : isOnline ? "En directo" : "Offline"}
          </span>
          <h1 className="home-title">Lolweapon Resubidos</h1>
          <p className="home-subtitle">
            Directo, archivo reciente y actividad de YouTube en un solo lugar.
          </p>
        </div>
        <a
          href={`https://www.twitch.tv/${twitchChannel}`}
          target="_blank"
          rel="noreferrer"
          className="home-twitch-link"
        >
          Abrir Twitch
        </a>
      </section>

      <section className="home-section home-stream-section">
        <div className="stream-block">
          <div className="stream-layout">
            <div className="stream-main-column">
              {isMiniMode ? (
                <>
                  <button type="button" className="mini-player-close" onClick={() => setIsMiniDismissed(true)}>
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="mini-player-resize"
                    aria-label="Redimensionar mini player"
                    onPointerDown={startMiniResize}
                    onPointerMove={resizeMiniPlayer}
                    onPointerUp={stopMiniResize}
                    onPointerCancel={stopMiniResize}
                  />
                </>
              ) : null}
              <div className="stream-frame stream-player">
                {twitchParent ? (
                  <div
                    key={`${playerKey}-${twitchParent}`}
                    id="twitch-player-embed"
                    ref={playerContainerRef}
                    className="twitch-player-embed"
                    aria-label="Directo de Twitch"
                  />
                ) : null}
              </div>

              <div className="stream-details">
                <div className="stream-avatar">
                  {currentProfile?.profile_image_url ? (
                    <img src={currentProfile.profile_image_url} alt="" />
                  ) : (
                    "LW"
                  )}
                </div>
                <div className="stream-details-copy">
                  <h2>{isTwitchLoading ? "Cargando metadata de Twitch..." : currentTitle}</h2>
                  <div className="stream-details-meta">
                    <span>{channelName}</span>
                    {isOnline && typeof currentStream.viewer_count === "number" ? (
                      <span>{currentStream.viewer_count} viewers</span>
                    ) : null}
                    {!isOnline ? <span>Offline</span> : null}
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
                <a
                  href="https://streamlabs.com/kalathraslolweapon/tip"
                  target="_blank"
                  rel="noreferrer"
                  className="stream-tip-button"
                >
                  <span className="paypal-icon" aria-hidden="true">P</span>
                  Donar por PayPal
                </a>
              </div>
            </div>
            <div className="stream-frame stream-chat">
              {twitchChatUrl ? <iframe src={twitchChatUrl} title="Chat de Twitch" /> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">Archivo</span>
            <h2>Últimos directos registrados</h2>
          </div>
          <button type="button" className="home-section-action" onClick={onTrackerOpen}>
            Ver rastreador
          </button>
        </div>

        {recentLives.length ? (
          <div className="home-live-grid">
            {recentLives.map((live) => (
              <RecentLiveCard key={live.id} live={live} />
            ))}
          </div>
        ) : (
          <div className="home-empty-panel">No hay directos registrados todavía.</div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">YouTube</span>
            <h2>Últimos videos</h2>
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
          <div className="home-loading-panel">
            <span />
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
