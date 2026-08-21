"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { House, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { getClientTwitchStatus } from "@/lib/clientTwitchStatus";

const TWITCH_EMBED_SCRIPT_URL = "https://player.twitch.tv/js/embed/v1.js";
const MINI_PLAYER_SIZE_STORAGE_KEY = "kala_twitch_mini_player_width";
const MINI_PLAYER_DEFAULT_WIDTH = 534;
const MINI_PLAYER_MIN_WIDTH = 534;
const MINI_PLAYER_MAX_WIDTH = 720;

function loadTwitchEmbedScript() {
  if (window.Twitch?.Player) return Promise.resolve();
  if (window.__twitchEmbedScriptPromise) return window.__twitchEmbedScriptPromise;

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

function buildMiniStyle(width, baseSize = null, viewportWidthOverride = null) {
  const viewportWidth = viewportWidthOverride ?? (typeof window === "undefined" ? width + 32 : window.innerWidth || width + 32);
  const viewportGap = 32;
  const visualWidth = Math.max(
    Math.min(MINI_PLAYER_MIN_WIDTH, viewportWidth - viewportGap),
    Math.min(width, viewportWidth - viewportGap),
  );
  const visualHeight = Math.round((visualWidth * 9) / 16);
  const baseWidth = baseSize?.width > 0 ? baseSize.width : visualWidth;
  const baseHeight = baseSize?.height > 0 ? baseSize.height : visualHeight;
  const scale = visualWidth / baseWidth;

  return {
    bottom: "calc(3.6rem + env(safe-area-inset-bottom))",
    height: `${visualHeight}px`,
    left: "auto",
    right: "1.25rem",
    top: "auto",
    width: `${visualWidth}px`,
    "--twitch-frame-height": `${baseHeight}px`,
    "--twitch-frame-scale": scale,
    "--twitch-frame-width": `${baseWidth}px`,
  };
}

function buildHomeStyle(anchor) {
  const rect = anchor.getBoundingClientRect();
  const isDualCompanion = anchor.classList.contains("stream-twitch-companion");
  const fixedBodyOffset = document.body.classList.contains("is-dual-theater-open")
    ? Number.parseFloat(document.body.style.top) || 0
    : 0;

  return {
    bottom: "auto",
    borderRadius: isDualCompanion
      ? "0 var(--radius-lg) 0 0"
      : "var(--radius-lg) 0 0 var(--radius-lg)",
    height: `${rect.height}px`,
    left: `${rect.left}px`,
    right: "auto",
    top: `${rect.top + fixedBodyOffset}px`,
    width: `${rect.width}px`,
    "--twitch-frame-height": `${rect.height}px`,
    "--twitch-frame-scale": 1,
    "--twitch-frame-width": `${rect.width}px`,
  };
}

function startMutedPlayback(player) {
  try {
    player?.setMuted?.(true);
  } catch {}

  try {
    const playResult = player?.play?.();
    playResult?.catch?.(() => {});
  } catch {}
}

function stopPlayerPlayback(player) {
  try {
    player?.setMuted?.(true);
  } catch {}

  try {
    player?.pause?.();
  } catch {}
}

function notifyPlaybackState(state) {
  window.dispatchEvent(new CustomEvent("kala:twitch-playback-state", { detail: { state } }));
}

export default function PersistentTwitchPlayer({ twitchLogin }) {
  const pathname = usePathname();
  const twitchChannel = twitchLogin || process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN || "kalathraslolweapon";
  const [currentPath, setCurrentPath] = useState("");
  const [twitchParent, setTwitchParent] = useState("");
  const [currentStream, setCurrentStream] = useState(null);
  const [isPlayerOnline, setIsPlayerOnline] = useState(false);
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [isMiniViewportAllowed, setIsMiniViewportAllowed] = useState(false);
  const [hasHomeAnchor, setHasHomeAnchor] = useState(false);
  const [miniPlayerWidth, setMiniPlayerWidth] = useState(MINI_PLAYER_DEFAULT_WIDTH);
  const [playerStyle, setPlayerStyle] = useState(() => (
    buildMiniStyle(MINI_PLAYER_DEFAULT_WIDTH, null, MINI_PLAYER_DEFAULT_WIDTH + 32)
  ));
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const playerModeRef = useRef("hidden");
  const isDualModeRef = useRef(false);
  const isPlayerOnlineRef = useRef(false);
  const isPlaybackPausedRef = useRef(false);
  const ignoreNextPauseRef = useRef(false);
  const dualResumeTimerRef = useRef(null);
  const dualPlaybackMonitorRef = useRef(null);
  const resizeStateRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const isHomeRoute = currentPath === "/inicio" || currentPath === "/";
  const isStreamPlayable = Boolean(currentStream) || isPlayerOnline;
  const shouldShowMini = !isHomeRoute && isMiniViewportAllowed && isStreamPlayable && !isMiniDismissed;
  const playerMode = isHomeRoute && hasHomeAnchor ? "home" : shouldShowMini ? "mini" : "hidden";
  const isVisible = playerMode !== "hidden";

  function ensureDualPlayback() {
    const player = playerRef.current;
    if (
      !player
      || !isDualModeRef.current
      || playerModeRef.current !== "home"
      || document.hidden
      || !isPlayerOnlineRef.current
    ) return;

    try {
      if (player.isPaused?.() === false) {
        isPlaybackPausedRef.current = false;
        notifyPlaybackState("playing");
        return;
      }
    } catch {}

    isPlaybackPausedRef.current = false;
    startMutedPlayback(player);
    notifyPlaybackState("starting");
  }

  function stopDualPlaybackMonitor() {
    window.clearInterval(dualPlaybackMonitorRef.current);
    dualPlaybackMonitorRef.current = null;
  }

  function startDualPlaybackMonitor() {
    stopDualPlaybackMonitor();
    ensureDualPlayback();
    dualPlaybackMonitorRef.current = window.setInterval(ensureDualPlayback, 2500);
  }

  useEffect(() => {
    playerModeRef.current = playerMode;
  }, [playerMode]);

  useEffect(() => {
    setCurrentPath(pathname || window.location.pathname);
  }, [pathname]);

  useEffect(() => {
    setTwitchParent(window.location.hostname);
    const savedWidth = Number(window.localStorage.getItem(MINI_PLAYER_SIZE_STORAGE_KEY));
    if (Number.isFinite(savedWidth)) setMiniPlayerWidth(clampMiniPlayerWidth(savedWidth));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewportAllowance = () => setIsMiniViewportAllowed(mediaQuery.matches);
    updateViewportAllowance();
    mediaQuery.addEventListener("change", updateViewportAllowance);
    return () => mediaQuery.removeEventListener("change", updateViewportAllowance);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MINI_PLAYER_SIZE_STORAGE_KEY, String(miniPlayerWidth));
  }, [miniPlayerWidth]);

  useEffect(() => {
    if (!isStreamPlayable) setIsMiniDismissed(false);
  }, [isStreamPlayable]);

  useEffect(() => {
    function notifyPathChange(event) {
      setCurrentPath(event.detail?.path || window.location.pathname);
    }

    window.addEventListener("popstate", notifyPathChange);
    window.addEventListener("kala:navigation", notifyPathChange);
    return () => {
      window.removeEventListener("popstate", notifyPathChange);
      window.removeEventListener("kala:navigation", notifyPathChange);
    };
  }, []);

  useEffect(() => {
    function handlePlayRequest(event) {
      if (playerModeRef.current === "hidden") return;

      if (event.detail?.muted !== false) {
        try {
          playerRef.current?.setMuted?.(true);
        } catch {}
      }

      const player = playerRef.current;
      try {
        if (player?.isPaused?.() === false) {
          isPlaybackPausedRef.current = false;
          notifyPlaybackState("playing");
          return;
        }
      } catch {}

      isPlaybackPausedRef.current = false;
      startMutedPlayback(player);
      notifyPlaybackState("starting");
    }

    window.addEventListener("kala:twitch-play-request", handlePlayRequest);
    return () => window.removeEventListener("kala:twitch-play-request", handlePlayRequest);
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.hidden
        || !isDualModeRef.current
        || playerModeRef.current !== "home"
        || !isPlaybackPausedRef.current
      ) return;

      ensureDualPlayback();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useLayoutEffect(() => {
    let frameId = 0;
    let observedAnchor = null;
    let observedPositionSource = null;
    const resizeObserver = new ResizeObserver(() => scheduleUpdate());

    function updatePlayerPosition() {
      const anchor = isHomeRoute ? document.querySelector("[data-twitch-player-anchor]") : null;
      const hasUsableAnchor = Boolean(anchor && anchor.getBoundingClientRect().width > 0 && anchor.getBoundingClientRect().height > 0);
      const positionSource = anchor?.closest(".stream-layout")?.querySelector(".stream-main-column") || null;

      if (anchor !== observedAnchor || positionSource !== observedPositionSource) {
        resizeObserver.disconnect();
        if (anchor) resizeObserver.observe(anchor);
        if (positionSource && positionSource !== anchor) resizeObserver.observe(positionSource);
        observedAnchor = anchor;
        observedPositionSource = positionSource;
      }

      setHasHomeAnchor(hasUsableAnchor);
      setPlayerStyle(hasUsableAnchor ? buildHomeStyle(anchor) : buildMiniStyle(miniPlayerWidth));

      if (!hasUsableAnchor && isDualModeRef.current) {
        isDualModeRef.current = false;
        stopDualPlaybackMonitor();
      }
    }

    function scheduleUpdate(event) {
      const requestedMode = event?.detail?.mode;
      const isEnteringDualMode = requestedMode === "dual";

      if (requestedMode) {
        isDualModeRef.current = isEnteringDualMode;
        if (isEnteringDualMode) startDualPlaybackMonitor();
        else stopDualPlaybackMonitor();
      }
      if (isEnteringDualMode) {
        try {
          playerRef.current?.setMuted?.(true);
        } catch {}
        isPlaybackPausedRef.current = false;
      }
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        updatePlayerPosition();
        if (isEnteringDualMode) {
          startMutedPlayback(playerRef.current);
          notifyPlaybackState("starting");
        }
      });
    }

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("kala:twitch-anchor-change", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("kala:twitch-anchor-change", scheduleUpdate);
    };
  }, [isHomeRoute, miniPlayerWidth]);

  useEffect(() => {
    if (!twitchParent) return undefined;
    let isCancelled = false;

    loadTwitchEmbedScript()
      .then(() => {
        if (isCancelled || !window.Twitch?.Player) return;
        const player = new window.Twitch.Player("persistent-twitch-player-embed", {
          channel: twitchChannel,
          parent: [twitchParent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });

        playerRef.current = player;
        player.addEventListener(window.Twitch.Player.READY, () => {
          notifyPlaybackState("ready");
          if (playerModeRef.current !== "hidden" && !isPlaybackPausedRef.current) startMutedPlayback(player);
        });
        player.addEventListener(window.Twitch.Player.ONLINE, () => {
          setIsPlayerOnline(true);
          isPlayerOnlineRef.current = true;
          notifyPlaybackState("online");
          if (playerModeRef.current !== "hidden" && !isPlaybackPausedRef.current) startMutedPlayback(player);
        });
        if (window.Twitch.Player.PLAY) {
          player.addEventListener(window.Twitch.Player.PLAY, () => {
            isPlaybackPausedRef.current = false;
            notifyPlaybackState("playing");
          });
        }
        if (window.Twitch.Player.PLAYING) {
          player.addEventListener(window.Twitch.Player.PLAYING, () => {
            isPlaybackPausedRef.current = false;
            notifyPlaybackState("playing");
          });
        }
        if (window.Twitch.Player.PAUSE) {
          player.addEventListener(window.Twitch.Player.PAUSE, () => {
            if (ignoreNextPauseRef.current) {
              ignoreNextPauseRef.current = false;
              return;
            }

            if (isDualModeRef.current && playerModeRef.current === "home" && !document.hidden) {
              isPlaybackPausedRef.current = true;
              notifyPlaybackState("starting");
              window.clearTimeout(dualResumeTimerRef.current);
              dualResumeTimerRef.current = window.setTimeout(() => {
                if (!isDualModeRef.current || playerModeRef.current !== "home") return;
                isPlaybackPausedRef.current = false;
                startMutedPlayback(player);
              }, 250);
              return;
            }

            isPlaybackPausedRef.current = true;
            notifyPlaybackState("paused");
          });
        }
        if (window.Twitch.Player.PLAYBACK_BLOCKED) {
          player.addEventListener(window.Twitch.Player.PLAYBACK_BLOCKED, () => {
            isPlaybackPausedRef.current = true;
            notifyPlaybackState("blocked");
          });
        }
        if (window.Twitch.Player.OFFLINE) {
          player.addEventListener(window.Twitch.Player.OFFLINE, () => {
            setIsPlayerOnline(false);
            isPlayerOnlineRef.current = false;
            notifyPlaybackState("offline");
          });
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      window.clearTimeout(dualResumeTimerRef.current);
      stopDualPlaybackMonitor();
      stopPlayerPlayback(playerRef.current);
      if (typeof playerRef.current?.destroy === "function") playerRef.current.destroy();
      playerRef.current = null;
    };
  }, [twitchChannel, twitchParent]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (playerMode === "hidden") {
      notifyPlaybackState("hidden");
      ignoreNextPauseRef.current = true;
      stopPlayerPlayback(playerRef.current);
      const resetPauseGuard = window.setTimeout(() => {
        ignoreNextPauseRef.current = false;
      }, 250);
      return () => {
        window.clearTimeout(resetPauseGuard);
        ignoreNextPauseRef.current = false;
      };
    } else if (!isPlaybackPausedRef.current) {
      startMutedPlayback(playerRef.current);
    }
    return undefined;
  }, [playerMode]);

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      try {
        const data = await getClientTwitchStatus();
        if (isMounted) {
          setCurrentStream(data.stream || null);
          isPlayerOnlineRef.current = Boolean(data.stream);
          if (data.stream) setIsPlayerOnline(true);
        }
      } catch {
        if (isMounted) setCurrentStream(null);
      }
    }

    refreshStatus();
    const intervalId = window.setInterval(refreshStatus, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  function applyStyleToContainer(style) {
    const element = playerContainerRef.current;
    if (!element) return;
    element.style.transition = "none";
    Object.entries(style).forEach(([key, value]) => {
      if (key.startsWith("--")) element.style.setProperty(key, String(value));
      else element.style[key] = value;
    });
  }

  function startMiniResize(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: miniPlayerWidth,
      currentWidth: miniPlayerWidth,
    };
  }

  function resizeMiniPlayer(event) {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextWidth = clampMiniPlayerWidth(resizeState.startWidth + (resizeState.startX - event.clientX));
    resizeState.currentWidth = nextWidth;
    if (resizeFrameRef.current) window.cancelAnimationFrame(resizeFrameRef.current);
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      applyStyleToContainer(buildMiniStyle(nextWidth));
      resizeFrameRef.current = null;
    });
  }

  function stopMiniResize(event) {
    if (resizeStateRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const finalWidth = resizeStateRef.current.currentWidth;
    resizeStateRef.current = null;
    if (playerContainerRef.current) playerContainerRef.current.style.transition = "";
    setMiniPlayerWidth(finalWidth);
  }

  function goToHome(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsMiniDismissed(false);
    window.scrollTo(0, 0);
    window.history.pushState(null, "", "/inicio");
    window.dispatchEvent(new CustomEvent("kala:navigation", { detail: { path: "/inicio" } }));
  }

  function closeMiniPlayer(event) {
    event.preventDefault();
    event.stopPropagation();
    stopPlayerPlayback(playerRef.current);
    setIsMiniDismissed(true);
  }

  return (
    <div
      ref={playerContainerRef}
      className={`persistent-twitch-player is-${playerMode} ${playerMode === "mini" ? "is-floating" : ""}`}
      style={playerStyle}
      aria-hidden={!isVisible}
    >
      {playerMode === "mini" ? (
        <>
          <button type="button" className="mini-player-action mini-player-close" aria-label="Cerrar mini player" title="Cerrar mini player" onClick={closeMiniPlayer}>
            <X aria-hidden="true" />
          </button>
          <button type="button" className="mini-player-action mini-player-home" aria-label="Volver al inicio" title="Volver al inicio" onClick={goToHome}>
            <House aria-hidden="true" />
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
      <div className="persistent-twitch-frame">
        <div id="persistent-twitch-player-embed" className="twitch-player-embed" aria-label="Directo de Twitch" />
      </div>
    </div>
  );
}
