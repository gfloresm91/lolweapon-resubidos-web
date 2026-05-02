"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { House, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const TWITCH_EMBED_SCRIPT_URL = "https://player.twitch.tv/js/embed/v1.js";
const MINI_PLAYER_SIZE_STORAGE_KEY = "kala_twitch_mini_player_width";
const MINI_PLAYER_DEFAULT_WIDTH = 380;
const MINI_PLAYER_MIN_WIDTH = 380;
const MINI_PLAYER_MAX_WIDTH = 720;
const MINI_ROUTES = ["/rastreador", "/biblioteca-anime", "/spacedrum"];

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

function buildMiniStyle(width) {
  return {
    bottom: "calc(3.6rem + env(safe-area-inset-bottom))",
    height: `${Math.round((width * 9) / 16)}px`,
    right: "1.25rem",
    top: "auto",
    width: `min(${width}px, calc(100vw - 2rem))`,
  };
}

function buildHiddenStyle(width) {
  return {
    ...buildMiniStyle(width),
    opacity: 0,
    pointerEvents: "none",
  };
}

function tryMutedAutoplay(player) {
  try {
    player?.setMuted?.(true);
  } catch {}

  try {
    const playResult = player?.play?.();
    playResult?.catch?.(() => {});
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
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [isSuppressingTransition, setIsSuppressingTransition] = useState(false);
  const [miniPlayerWidth, setMiniPlayerWidth] = useState(MINI_PLAYER_DEFAULT_WIDTH);
  const [playerStyle, setPlayerStyle] = useState(buildMiniStyle(MINI_PLAYER_DEFAULT_WIDTH));
  const playerRef = useRef(null);
  const routeModeRef = useRef("hidden");
  const resizeStateRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const isOnline = Boolean(currentStream);
  const routeMode = getRouteMode(currentPath, currentHostname);
  const isVisible = routeMode === "full" || (routeMode === "mini" && isOnline && !isMiniDismissed);

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
    if (!isOnline) {
      setIsMiniDismissed(false);
    }
  }, [isOnline]);

  useEffect(() => {
    function notifyPathChange(event) {
      const nextPath = event.detail?.path || window.location.pathname;
      const nextMode = getRouteMode(nextPath, window.location.hostname);

      if (routeModeRef.current === "full" && nextMode === "mini") {
        setIsSuppressingTransition(true);
        setPlayerStyle(buildMiniStyle(miniPlayerWidth));
        window.requestAnimationFrame(() => setIsSuppressingTransition(false));
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
  }, []);

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
        player.addEventListener(window.Twitch.Player.READY, () => tryMutedAutoplay(player));
        player.addEventListener(window.Twitch.Player.ONLINE, () => tryMutedAutoplay(player));
      })
      .catch(() => {});

    return () => {
      isCancelled = true;

      try {
        playerRef.current?.setMuted?.(true);
        playerRef.current?.pause?.();
      } catch {}

      if (typeof playerRef.current?.destroy === "function") {
        playerRef.current.destroy();
      }

      playerRef.current = null;
    };
  }, [twitchChannel, twitchParent]);

  useEffect(() => {
    if (!isVisible || !playerRef.current) {
      return undefined;
    }

    let frameId = window.requestAnimationFrame(() => {
      tryMutedAutoplay(playerRef.current);
    });
    const timeoutIds = [250, 900, 1800].map((delay) => (
      window.setTimeout(() => tryMutedAutoplay(playerRef.current), delay)
    ));

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [isVisible, routeMode, isOnline]);

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      try {
        const response = await fetch("/api/twitch/status", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setCurrentStream(data.stream || null);
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
    let retryCount = 0;

    function updatePlayerPosition() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (routeMode === "full") {
          const anchor = document.querySelector('[data-twitch-player-anchor="home"]');

          if (anchor) {
            const rect = anchor.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
              setPlayerStyle({
                borderRadius: window.getComputedStyle(anchor.parentElement || anchor).borderRadius,
                bottom: "auto",
                height: `${rect.height}px`,
                left: `${rect.left}px`,
                opacity: 1,
                pointerEvents: "auto",
                right: "auto",
                top: `${rect.top}px`,
                width: `${rect.width}px`,
              });
              return;
            }
          }

          setPlayerStyle(buildHiddenStyle(miniPlayerWidth));

          if (retryCount < 30) {
            retryCount += 1;
            updatePlayerPosition();
          }

          return;
        }

        setPlayerStyle(buildMiniStyle(miniPlayerWidth));
      });
    }

    updatePlayerPosition();
    window.addEventListener("resize", updatePlayerPosition);
    window.addEventListener("scroll", updatePlayerPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePlayerPosition);
      window.removeEventListener("scroll", updatePlayerPosition, true);
    };
  }, [miniPlayerWidth, routeMode]);

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

  function goToHome() {
    setIsMiniDismissed(false);
    router.push("/inicio");
  }

  return (
    <div
      className={`persistent-twitch-player is-${routeMode} ${isVisible ? "" : "is-hidden"}`}
      data-suppress-transition={isSuppressingTransition ? "true" : "false"}
      style={playerStyle}
      aria-hidden={!isVisible}
    >
      {routeMode === "mini" ? (
        <>
          <button
            type="button"
            className="mini-player-action mini-player-close"
            aria-label="Cerrar mini player"
            title="Cerrar mini player"
            onClick={() => setIsMiniDismissed(true)}
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
