"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { House, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const TWITCH_EMBED_SCRIPT_URL = "https://player.twitch.tv/js/embed/v1.js";
const MINI_PLAYER_SIZE_STORAGE_KEY = "kala_twitch_mini_player_width";
const MINI_PLAYER_DEFAULT_WIDTH = 380;
const MINI_PLAYER_MIN_WIDTH = 380;
const MINI_PLAYER_MAX_WIDTH = 720;
const MINI_ROUTES = ["/rastreador", "/mi-lista", "/biblioteca-anime", "/administracion", "/spacedrum"];
const PLAY_RESUME_DELAYS = [0, 120, 350, 900, 1800, 3200];
const PLAY_KEEP_ALIVE_INTERVAL_MS = 10000;

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

function getRouteMode(pathname, hostname = "") {
  if (pathname === "/" && /^(resubidos|viendo)(-|\.|$)/.test(hostname)) {
    return "mini";
  }

  if (pathname === "/" || pathname === "/inicio") {
    return "full";
  }

  if (MINI_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return "mini";
  }

  return "hidden";
}

function buildMiniStyle(width, baseSize = null) {
  const viewportWidth = typeof window === "undefined" ? width + 32 : window.innerWidth || width + 32;
  const visualWidth = Math.min(width, Math.max(MINI_PLAYER_MIN_WIDTH, viewportWidth - 32));
  const visualHeight = Math.round((visualWidth * 9) / 16);
  const baseWidth = baseSize?.width > 0 ? baseSize.width : visualWidth;
  const baseHeight = baseSize?.height > 0 ? baseSize.height : visualHeight;
  const scale = visualWidth / baseWidth;

  return {
    bottom: "calc(3.6rem + env(safe-area-inset-bottom))",
    "--twitch-frame-height": `${baseHeight}px`,
    "--twitch-frame-scale": scale,
    "--twitch-frame-width": `${baseWidth}px`,
    height: `${visualHeight}px`,
    right: "1.25rem",
    top: "auto",
    width: `${visualWidth}px`,
  };
}

function buildHiddenStyle(width) {
  return {
    ...buildMiniStyle(width),
    opacity: 0,
    pointerEvents: "none",
  };
}

function isAnchorVisible(rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

  return (
    rect.bottom > 24 &&
    rect.top < viewportHeight - 24 &&
    rect.right > 24 &&
    rect.left < viewportWidth - 24
  );
}

function tryAutoplay(player, mutedPreferenceRef) {
  let shouldMute = mutedPreferenceRef.current;

  try {
    const currentMuted = player?.getMuted?.();

    if (typeof currentMuted === "boolean") {
      shouldMute = currentMuted;
      mutedPreferenceRef.current = currentMuted;
    }
  } catch {}

  try {
    player?.setMuted?.(shouldMute);
  } catch {}

  try {
    const playResult = player?.play?.();
    playResult?.catch?.(() => {});
  } catch {}
}

function schedulePlaybackResume(player, mutedPreferenceRef) {
  const frameId = window.requestAnimationFrame(() => {
    tryAutoplay(player, mutedPreferenceRef);
  });
  const timeoutIds = PLAY_RESUME_DELAYS.map((delay) => (
    window.setTimeout(() => tryAutoplay(player, mutedPreferenceRef), delay)
  ));

  return () => {
    window.cancelAnimationFrame(frameId);
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
}

function stopPlayerPlayback(player) {
  try {
    player?.setMuted?.(true);
  } catch {}

  try {
    player?.pause?.();
  } catch {}
}

export default function PersistentTwitchPlayer({ twitchLogin }) {
  const pathname = usePathname();
  const router = useRouter();
  const twitchChannel = twitchLogin || "kalathraslolweapon";
  const [currentPath, setCurrentPath] = useState("");
  const [currentHostname, setCurrentHostname] = useState("");
  const [twitchParent, setTwitchParent] = useState("");
  const [currentStream, setCurrentStream] = useState(null);
  const [isPlayerOnline, setIsPlayerOnline] = useState(false);
  const [hasActivatedPlayer, setHasActivatedPlayer] = useState(false);
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [isSuppressingTransition, setIsSuppressingTransition] = useState(false);
  const [isDockedToHome, setIsDockedToHome] = useState(false);
  const [miniPlayerWidth, setMiniPlayerWidth] = useState(MINI_PLAYER_DEFAULT_WIDTH);
  const [playerBaseSize, setPlayerBaseSize] = useState(null);
  const [playerStyle, setPlayerStyle] = useState(buildMiniStyle(MINI_PLAYER_DEFAULT_WIDTH));
  const playerRef = useRef(null);
  const routeModeRef = useRef("hidden");
  const mutedPreferenceRef = useRef(true);
  const resizeStateRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const wasDockedToHomeRef = useRef(false);
  const isOnline = Boolean(currentStream);
  const isStreamPlayable = isOnline || isPlayerOnline;
  const routeMode = getRouteMode(currentPath, currentHostname);
  const shouldKeepPlayerVisible = isStreamPlayable && !isMiniDismissed;
  const playerMode = routeMode === "hidden" && shouldKeepPlayerVisible ? "mini" : routeMode;
  const isVisible = (playerMode === "full" && (isDockedToHome || isStreamPlayable)) || (playerMode === "mini" && shouldKeepPlayerVisible);
  const showMiniControls = playerMode === "mini" || (playerMode === "full" && !isDockedToHome);

  useEffect(() => {
    routeModeRef.current = routeMode;
  }, [routeMode]);

  useEffect(() => {
    setCurrentPath(pathname || window.location.pathname);
  }, [pathname]);

  useEffect(() => {
    setTwitchParent(window.location.hostname);
    setCurrentHostname(window.location.hostname);

    const savedWidth = Number(window.localStorage.getItem(MINI_PLAYER_SIZE_STORAGE_KEY));

    if (Number.isFinite(savedWidth)) {
      setMiniPlayerWidth(clampMiniPlayerWidth(savedWidth));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MINI_PLAYER_SIZE_STORAGE_KEY, String(miniPlayerWidth));
  }, [miniPlayerWidth]);

  useEffect(() => {
    if (!isStreamPlayable) {
      setIsMiniDismissed(false);
    }
  }, [isStreamPlayable]);

  useEffect(() => {
    if (routeMode === "full" || isStreamPlayable) {
      setHasActivatedPlayer(true);
    }
  }, [isStreamPlayable, routeMode]);

  useEffect(() => {
    if (routeMode !== "mini" && isMiniDismissed) {
      setIsMiniDismissed(false);
    }
  }, [isMiniDismissed, routeMode]);

  useEffect(() => {
    function notifyPathChange(event) {
      const nextPath = event.detail?.path || window.location.pathname;
      const nextMode = getRouteMode(nextPath, window.location.hostname);

      const isFullToMini = routeModeRef.current === "full" && nextMode === "mini";

      if (isFullToMini) {
        setIsSuppressingTransition(true);
        setPlayerStyle(buildMiniStyle(miniPlayerWidth, playerBaseSize));
        window.requestAnimationFrame(() => {
          setIsSuppressingTransition(false);
          if (playerRef.current) {
            schedulePlaybackResume(playerRef.current, mutedPreferenceRef);
          }
        });
      }

      setCurrentPath(nextPath);
      setCurrentHostname(window.location.hostname);
    }

    window.addEventListener("popstate", notifyPathChange);
    window.addEventListener("kala:navigation", notifyPathChange);

    return () => {
      window.removeEventListener("popstate", notifyPathChange);
      window.removeEventListener("kala:navigation", notifyPathChange);
    };
  }, [miniPlayerWidth, playerBaseSize]);

  useEffect(() => {
    if (!twitchParent) {
      return undefined;
    }

    let isCancelled = false;

    loadTwitchEmbedScript()
      .then(() => {
        if (isCancelled || !window.Twitch?.Player) {
          return;
        }

        const player = new window.Twitch.Player("persistent-twitch-player-embed", {
          channel: twitchChannel,
          parent: [twitchParent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });

        playerRef.current = player;
        player.addEventListener(window.Twitch.Player.READY, () => tryAutoplay(player, mutedPreferenceRef));
        player.addEventListener(window.Twitch.Player.ONLINE, () => {
          setIsPlayerOnline(true);
          setHasActivatedPlayer(true);
          tryAutoplay(player, mutedPreferenceRef);
        });

        if (window.Twitch.Player.OFFLINE) {
          player.addEventListener(window.Twitch.Player.OFFLINE, () => {
            setIsPlayerOnline(false);
          });
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      stopPlayerPlayback(playerRef.current);

      if (typeof playerRef.current?.destroy === "function") {
        playerRef.current.destroy();
      }

      playerRef.current = null;
    };
  }, [twitchChannel, twitchParent]);

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }

    if (isMiniDismissed) {
      stopPlayerPlayback(playerRef.current);
    }
  }, [isMiniDismissed]);

  useEffect(() => {
    if (!isVisible || !playerRef.current) {
      return undefined;
    }

    return schedulePlaybackResume(playerRef.current, mutedPreferenceRef);
  }, [isVisible, routeMode]);

  useEffect(() => {
    function resume() {
      if (isVisible && playerRef.current) {
        tryAutoplay(playerRef.current, mutedPreferenceRef);
      }
    }

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);

    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !playerRef.current) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (playerRef.current) {
        tryAutoplay(playerRef.current, mutedPreferenceRef);
      }
    }, PLAY_KEEP_ALIVE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !playerRef.current) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      try {
        const currentMuted = playerRef.current?.getMuted?.();

        if (typeof currentMuted === "boolean") {
          mutedPreferenceRef.current = currentMuted;
        }
      } catch {}
    }, 750);

    return () => window.clearInterval(intervalId);
  }, [isVisible]);

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      try {
        const response = await fetch("/api/twitch/status", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setCurrentStream(data.stream || null);
          if (data.stream) {
            setIsPlayerOnline(true);
            setHasActivatedPlayer(true);
          }
        }
      } catch {
        if (isMounted) {
          setCurrentStream(null);
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

  useLayoutEffect(() => {
    let frameId = 0;
    let retryTimeoutId = 0;
    let observer = null;

    function updatePlayerPosition() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (playerMode === "full") {
          const anchor = document.querySelector('[data-twitch-player-anchor="home"]');

          if (anchor) {
            const rect = anchor.getBoundingClientRect();

            if (isAnchorVisible(rect)) {
              setPlayerBaseSize((currentSize) => {
                const nextSize = {
                  height: Math.round(rect.height),
                  width: Math.round(rect.width),
                };

                if (currentSize?.height === nextSize.height && currentSize?.width === nextSize.width) {
                  return currentSize;
                }

                return nextSize;
              });
              setPlayerStyle({
                borderRadius: window.getComputedStyle(anchor.parentElement || anchor).borderRadius,
                bottom: "auto",
                "--twitch-frame-height": `${rect.height}px`,
                "--twitch-frame-scale": 1,
                "--twitch-frame-width": `${rect.width}px`,
                height: `${rect.height}px`,
                left: `${rect.left}px`,
                opacity: 1,
                pointerEvents: "auto",
                right: "auto",
                top: `${rect.top}px`,
                width: `${rect.width}px`,
              });
              setIsDockedToHome(true);
              wasDockedToHomeRef.current = true;
              return;
            }
          }

          setIsDockedToHome(false);
          setPlayerStyle(buildMiniStyle(miniPlayerWidth, playerBaseSize));

          if (wasDockedToHomeRef.current && playerRef.current) {
            schedulePlaybackResume(playerRef.current, mutedPreferenceRef);
          }

          wasDockedToHomeRef.current = false;
          window.clearTimeout(retryTimeoutId);
          retryTimeoutId = window.setTimeout(updatePlayerPosition, 120);

          return;
        }

        setIsDockedToHome(false);
        wasDockedToHomeRef.current = false;
        setPlayerStyle(buildMiniStyle(miniPlayerWidth, playerBaseSize));
      });
    }

    updatePlayerPosition();

    if (routeMode === "full") {
      observer = new MutationObserver(updatePlayerPosition);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("resize", updatePlayerPosition);
    window.addEventListener("scroll", updatePlayerPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(retryTimeoutId);
      observer?.disconnect();
      window.removeEventListener("resize", updatePlayerPosition);
      window.removeEventListener("scroll", updatePlayerPosition, true);
    };
  }, [miniPlayerWidth, playerBaseSize, playerMode, routeMode]);

  function startMiniResize(event) {
    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: miniPlayerWidth,
    };
  }

  function resizeMiniPlayer(event) {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const nextWidth = clampMiniPlayerWidth(resizeState.startWidth + (resizeState.startX - event.clientX));

    if (resizeFrameRef.current) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      setMiniPlayerWidth(nextWidth);
      resizeFrameRef.current = null;
    });
  }

  function stopMiniResize(event) {
    if (resizeStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    resizeStateRef.current = null;
  }

  function goToHome(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setIsMiniDismissed(false);
    router.push("/inicio");
  }

  function closeMiniPlayer(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    stopPlayerPlayback(playerRef.current);
    setIsMiniDismissed(true);
  }

  return (
    <div
      className={`persistent-twitch-player is-${playerMode} ${!isDockedToHome ? "is-floating" : ""} ${isVisible ? "" : "is-hidden"}`}
      data-suppress-transition={isSuppressingTransition ? "true" : "false"}
      style={playerStyle}
      aria-hidden={!isVisible}
    >
      {showMiniControls ? (
        <>
          <button
            type="button"
            className="mini-player-action mini-player-close"
            aria-label="Cerrar mini player"
            title="Cerrar mini player"
            onClick={closeMiniPlayer}
          >
            <X aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mini-player-action mini-player-home"
            aria-label="Volver al inicio"
            title="Volver al inicio"
            onClick={goToHome}
          >
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
