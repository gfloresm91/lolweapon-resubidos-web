"use client";

import { useEffect, useMemo, useState } from "react";

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

function RecentLiveCard({ live }) {
  const links = live.links || {};
  const hasLinks = ["telegram", "okru", "piero", "patreon"].some((platform) => links[platform]?.length);

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
      <span className={`home-live-link-state ${hasLinks ? "ready" : ""}`}>
        {hasLinks ? "Con enlaces" : "Sin enlaces cargados"}
      </span>
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
  onTrackerOpen,
}) {
  const [currentStream, setCurrentStream] = useState(twitchStream);
  const [currentProfile, setCurrentProfile] = useState(twitchProfile);
  const [currentChannelInfo, setCurrentChannelInfo] = useState(twitchChannelInfo);
  const [currentGame, setCurrentGame] = useState(twitchGame);
  const [isTwitchLoading, setIsTwitchLoading] = useState(true);
  const [videos, setVideos] = useState(youtubeVideos || []);
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(!(youtubeVideos || []).length);

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
  const twitchChannel = twitchLogin || "kalathraslolweapon";
  const isOnline = Boolean(currentStream);
  const channelName = currentProfile?.display_name || twitchChannel;
  const channelDescription = currentProfile?.description || "";
  const currentTitle = currentStream?.title || currentChannelInfo?.title || "Sin título configurado";
  const currentCategory = currentStream?.game_name || currentChannelInfo?.game_name || "";
  const categoryImage = currentGame?.box_art_url
    ? currentGame.box_art_url.replace("{width}", "96").replace("{height}", "128")
    : "";
  const parent = typeof window === "undefined" ? "localhost" : window.location.hostname;
  const twitchPlayerUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannel)}&parent=${encodeURIComponent(parent)}&muted=true`;
  const twitchChatUrl = `https://www.twitch.tv/embed/${encodeURIComponent(twitchChannel)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
  const playerKey = currentStream?.id ? `online-${currentStream.id}` : "offline";
  const streamStatusClass = isTwitchLoading ? "is-loading" : isOnline ? "is-online" : "is-offline";

  return (
    <main className="home-dashboard">
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

      <section className="home-section">
        <div className="stream-block">
          <div className="stream-layout">
            <div className="stream-main-column">
              <div className="stream-frame stream-player">
                <iframe
                  key={playerKey}
                  src={twitchPlayerUrl}
                  title="Directo de Twitch"
                  allowFullScreen
                />
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
              <iframe src={twitchChatUrl} title="Chat de Twitch" />
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
