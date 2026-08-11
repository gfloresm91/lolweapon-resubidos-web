"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ChevronDown, CirclePlay, Eye, FileText, Info, Link2, MessageSquare, X } from "lucide-react";
import { PENDING_LIVE_STATUS_LABEL } from "@/lib/animeDbMapping";
import TwitchCompanionPlayer from "@/components/TwitchCompanionPlayer";
import Tooltip from "@/components/Tooltip";

const DEFAULT_VK_LIVE_EMBED_URL = "https://live.vkvideo.ru/app/embed/redbreake";
const VK_LIVE_EMBED_URL = process.env.NEXT_PUBLIC_VK_LIVE_EMBED_URL || DEFAULT_VK_LIVE_EMBED_URL;
const IS_VK_MULTISTREAM_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VK_MULTISTREAM !== "false";
const PRESENCE_CLIENT_STORAGE_KEY = "kala_presence_client_id";
const PRESENCE_HEARTBEAT_MS = 20_000;
const PRESENCE_CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

function getPresenceClientId() {
  try {
    const storedId = window.localStorage.getItem(PRESENCE_CLIENT_STORAGE_KEY);
    if (storedId && PRESENCE_CLIENT_ID_PATTERN.test(storedId)) return storedId;

    const clientId = window.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(PRESENCE_CLIENT_STORAGE_KEY, clientId);
    return clientId;
  } catch {
    return window.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
}

function openTwitchSubscription(event) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return;
  }

  const shouldUseNativeTab = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
  if (shouldUseNativeTab) return;

  const popupWidth = Math.min(520, window.screen.availWidth - 32);
  const popupHeight = Math.min(760, window.screen.availHeight - 48);
  const popupLeft = Math.max(0, window.screenX + (window.outerWidth - popupWidth) / 2);
  const popupTop = Math.max(0, window.screenY + (window.outerHeight - popupHeight) / 2);
  const popup = window.open(
    "",
    "twitch-subscription",
    `popup=yes,width=${Math.round(popupWidth)},height=${Math.round(popupHeight)},left=${Math.round(popupLeft)},top=${Math.round(popupTop)},resizable=yes,scrollbars=yes`,
  );

  // If the popup was blocked, keep the anchor's native target=_blank behavior.
  if (!popup) return;

  event.preventDefault();
  popup.opener = null;
  popup.location.replace(event.currentTarget.href);
  popup.focus();
}

function StreamTitle({ isLoading, title }) {
  const titleRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = titleRef.current;
    if (!element || isLoading) {
      setIsTruncated(false);
      return undefined;
    }

    const measureOverflow = () => {
      setIsTruncated(
        element.scrollWidth > element.clientWidth + 1
        || element.scrollHeight > element.clientHeight + 1,
      );
    };
    const frameId = window.requestAnimationFrame(measureOverflow);
    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [isLoading, title]);

  const heading = (
    <h2
      ref={titleRef}
      aria-live="polite"
      aria-busy={isLoading}
      tabIndex={isTruncated ? 0 : undefined}
    >
      {isLoading
        ? <span className="stream-title-skeleton" aria-hidden="true" />
        : title}
    </h2>
  );

  return isTruncated ? (
    <Tooltip
      label={title}
      align="start"
      contentClassName="stream-title-tooltip"
    >
      {heading}
    </Tooltip>
  ) : heading;
}

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
  const [isOnlinePreview, setIsOnlinePreview] = useState(false);
  const [pageViewerCount, setPageViewerCount] = useState(null);
  const [isPagePresenceMeasuring, setIsPagePresenceMeasuring] = useState(false);
  const streamInfoSheetRef = useRef(null);
  const streamInfoDragRef = useRef({ active: false, startY: 0, startedAt: 0, offset: 0 });
  const wasTwitchOnlineRef = useRef(Boolean(twitchStream));
  const twitchChannel = twitchLogin || process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN || "kalathraslolweapon";
  const isTwitchActuallyOnline = Boolean(currentStream);
  const isOnline = isTwitchActuallyOnline || isOnlinePreview;
  const isDualMode = IS_VK_MULTISTREAM_ENABLED && streamMode === "dual";
  const isTwitchChatTheater = !isDualMode && isTwitchChatTheaterOpen;

  function resetStreamInfoDrag() {
    const sheet = streamInfoSheetRef.current;
    if (!sheet) return;
    sheet.classList.remove("is-dragging");
    sheet.style.transform = "";
  }

  function handleStreamInfoDragStart(event) {
    if (event.pointerType === "mouse") return;
    streamInfoDragRef.current = {
      active: true,
      startY: event.clientY,
      startedAt: performance.now(),
      offset: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    streamInfoSheetRef.current?.classList.add("is-dragging");
  }

  function handleStreamInfoDragMove(event) {
    const drag = streamInfoDragRef.current;
    if (!drag.active) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    drag.offset = offset;
    if (streamInfoSheetRef.current) {
      streamInfoSheetRef.current.style.transform = `translateY(${offset}px)`;
    }
  }

  function finishStreamInfoDrag(event) {
    const drag = streamInfoDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const elapsed = Math.max(1, performance.now() - drag.startedAt);
    const velocity = drag.offset / elapsed;
    const sheetHeight = streamInfoSheetRef.current?.offsetHeight || 0;
    const shouldClose = drag.offset >= Math.min(110, sheetHeight * 0.24)
      || (drag.offset >= 32 && velocity >= 0.55);

    if (shouldClose) {
      setIsStreamInfoOpen(false);
      return;
    }
    resetStreamInfoDrag();
  }

  useEffect(() => {
    setTwitchParent(window.location.hostname);
    if (process.env.NODE_ENV !== "production") {
      const params = new URLSearchParams(window.location.search);
      setIsOnlinePreview(params.get("preview") === "online");
    }
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
    const wasOnline = wasTwitchOnlineRef.current;
    wasTwitchOnlineRef.current = isTwitchActuallyOnline;
    if (!isTwitchActuallyOnline || wasOnline) return;

    window.dispatchEvent(new CustomEvent("kala:twitch-play-request", {
      detail: {
        muted: true,
        refreshChannel: true,
        source: "stream-went-online",
      },
    }));
  }, [isTwitchActuallyOnline]);

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
    if (!isOnline || mode === "mini") {
      setPageViewerCount(null);
      setIsPagePresenceMeasuring(false);
      return undefined;
    }

    let isMounted = true;
    let socket = null;
    let heartbeatTimer = null;
    let reconnectTimer = null;
    let qualificationTimer = null;
    let reconnectAttempt = 0;
    const clientId = getPresenceClientId();

    function send(type) {
      if (socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type, clientId, page: "home" }));
    }

    function clearHeartbeat() {
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    function startHeartbeat() {
      clearHeartbeat();
      if (document.visibilityState !== "visible") return;
      heartbeatTimer = window.setInterval(() => send("heartbeat"), PRESENCE_HEARTBEAT_MS);
    }

    function scheduleReconnect() {
      if (!isMounted || reconnectTimer) return;
      setPageViewerCount(null);
      const delays = [1000, 2000, 5000, 10_000, 30_000];
      const delay = delays[Math.min(reconnectAttempt, delays.length - 1)];
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      if (!isMounted || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/presence/ws`);

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        if (document.visibilityState === "visible") send("join");
        startHeartbeat();
      });
      socket.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload?.type === "presence:ready" || payload?.type === "presence:update") {
          const nextCount = Number(payload.count);
          if (Number.isInteger(nextCount) && nextCount >= 0) setPageViewerCount(nextCount);
        }
        if (payload?.type === "presence:joined") {
          setIsPagePresenceMeasuring(true);
          if (qualificationTimer) window.clearTimeout(qualificationTimer);
          const qualificationMs = Number(payload.qualificationMs);
          qualificationTimer = window.setTimeout(
            () => setIsPagePresenceMeasuring(false),
            (Number.isFinite(qualificationMs) ? qualificationMs : 15_000) + 6_000,
          );
        }
      });
      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => socket?.close());
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (socket?.readyState === WebSocket.OPEN) send("join");
        else connect();
        startHeartbeat();
      } else {
        send("leave");
        clearHeartbeat();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearHeartbeat();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (qualificationTimer) window.clearTimeout(qualificationTimer);
      send("leave");
      socket?.close();
    };
  }, [isOnline, mode]);

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
  const currentTitle = currentStream?.title
    || currentChannelInfo?.title
    || (isOnlinePreview ? "Directo de prueba para ajustar la vista online" : "Sin título configurado");
  const currentCategory = currentStream?.game_name
    || currentChannelInfo?.game_name
    || (isOnlinePreview ? "Just Chatting" : "");
  const viewerCount = typeof currentStream?.viewer_count === "number"
    ? currentStream.viewer_count
    : isOnlinePreview
      ? 1234
      : null;
  const categoryImage = currentGame?.box_art_url
    ? currentGame.box_art_url.replace("{width}", "96").replace("{height}", "128")
    : "";
  const twitchChatUrl = twitchParent
    ? `https://www.twitch.tv/embed/${encodeURIComponent(twitchChannel)}/chat?parent=${encodeURIComponent(twitchParent)}&darkpopout`
    : "";
  const visiblePlaybackState = isOnlinePreview && !isTwitchActuallyOnline
    ? "playing"
    : twitchPlaybackState;
  const twitchPlaybackLabel = !isOnline
    ? "Offline"
    : visiblePlaybackState === "blocked"
      ? "Activar Twitch"
    : visiblePlaybackState === "playing"
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
        <div className="stream-details-meta">
          <span className="stream-channel-name">{channelName}</span>
          {!isTwitchLoading ? (
            <span className={`stream-status-label ${isOnline ? "is-online" : "is-offline"}`}>
              {isOnline ? "En directo" : "Offline"}
            </span>
          ) : null}
        </div>
        <StreamTitle isLoading={isTwitchLoading} title={currentTitle} />
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
      {isOnline ? (
        <div className="stream-audience-summary" aria-label="Audiencia del directo">
          {typeof viewerCount === "number" ? (
            <span className="stream-viewers">
              <Eye aria-hidden="true" />
              <strong>{viewerCount.toLocaleString("es-CL")}</strong>
              <small>Twitch</small>
            </span>
          ) : null}
          <Tooltip
            label="Usuarios activos con la página visible durante al menos 15 segundos. Este conteo es independiente de Twitch."
            align="start"
            contentClassName="stream-page-viewers-tooltip"
          >
            <span
              className={`stream-viewers stream-page-viewers ${isPagePresenceMeasuring && pageViewerCount === 0 ? "is-measuring" : ""}`.trim()}
              tabIndex={0}
            >
              <span className="stream-page-viewers-dot" aria-hidden="true" />
              {isPagePresenceMeasuring && pageViewerCount === 0 ? (
                <small>Midiendo…</small>
              ) : (
                <>
                  <strong>{pageViewerCount == null ? "—" : pageViewerCount.toLocaleString("es-CL")}</strong>
                  <small>en esta página</small>
                </>
              )}
            </span>
          </Tooltip>
        </div>
      ) : null}
      <div className="stream-actions">
        <a
          href={`https://subs.twitch.tv/${encodeURIComponent(twitchChannel)}`}
          target="_blank"
          rel="noreferrer"
          className="home-twitch-link"
          onClick={openTwitchSubscription}
        >
          <span className="twitch-subscribe-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 2h18v12.4L17.4 19H13l-2.6 2.6V19H6V5.5L4 2Zm4 3v10h4v2l2-2h3.6l2.4-2.4V5H8Zm3 2h2v5h-2V7Zm4 0h2v5h-2V7Z" />
            </svg>
          </span>
          Suscribirse en Twitch
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
        {visiblePlaybackState === "blocked" && isOnline ? (
          <button type="button" className="stream-playback-retry" onClick={retryTwitchPlayback}>
            <span className="stream-playback-state is-blocked">{twitchPlaybackLabel}</span>
          </button>
        ) : (
          <span className={`stream-playback-state is-${visiblePlaybackState}`}>{twitchPlaybackLabel}</span>
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
                    <span>Video principal</span>
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
                ref={streamInfoSheetRef}
                className="stream-info-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Información del directo"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span
                  className="stream-info-sheet-handle"
                  aria-hidden="true"
                  onPointerDown={handleStreamInfoDragStart}
                  onPointerMove={handleStreamInfoDragMove}
                  onPointerUp={finishStreamInfoDrag}
                  onPointerCancel={finishStreamInfoDrag}
                />
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
