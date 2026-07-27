"use client";

import { useEffect, useMemo, useState } from "react";

import { CirclePlay, FileText, Link2 } from "lucide-react";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";

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
  const detailCtaLabel = okruCount > 0 ? "Ver resubido" : telegramCount > 0 ? "Ver links" : "Ver ficha";
  const DetailIcon = okruCount > 0 ? CirclePlay : telegramCount > 0 ? Link2 : FileText;
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
  const twitchChannel = twitchLogin || "kalathraslolweapon";
  const isOnline = Boolean(currentStream);

  useEffect(() => {
    setTwitchParent(window.location.hostname);
  }, []);

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
  const dashboardClassName = [
    "home-dashboard",
    mode === "mini" ? "is-mini-player" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={dashboardClassName}>
      <section className="home-section home-stream-section" aria-label="Transmisión en directo">
        <div className="stream-block">
          <div className="stream-layout">
            <div className="stream-main-column">
              <div className="stream-frame stream-player">
                {twitchParent ? (
                  <iframe
                    src={`https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannel)}&parent=${encodeURIComponent(twitchParent)}&autoplay=true`}
                    allowFullScreen
                    allow="autoplay; fullscreen"
                    title="Directo de Twitch"
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
                  <h2 aria-live="polite" aria-busy={isTwitchLoading}>
                    {isTwitchLoading
                      ? <span className="stream-title-skeleton" aria-hidden="true" />
                      : currentTitle}
                  </h2>
                  <div className="stream-details-meta">
                    <span>{channelName}</span>
                    {isOnline && typeof currentStream.viewer_count === "number" ? (
                      <span>{currentStream.viewer_count} viewers</span>
                    ) : null}
                    {!isOnline && !isTwitchLoading ? <span className="stream-offline-state">Offline</span> : null}
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
            <div className="stream-frame stream-chat">
              {twitchChatUrl ? <iframe src={twitchChatUrl} title="Chat de Twitch" /> : null}
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
