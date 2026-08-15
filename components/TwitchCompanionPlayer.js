"use client";

import { useEffect, useRef } from "react";

const TWITCH_EMBED_SCRIPT_URL = "https://player.twitch.tv/js/embed/v1.js";
const RESUME_RETRY_DELAYS_MS = [0, 150, 400, 900, 1800, 3200];

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

function notifyPlaybackState(state) {
  window.dispatchEvent(new CustomEvent("kala:twitch-playback-state", { detail: { state } }));
}

// In-flow Twitch player shared by Twitch-only and the VK + Twitch companion.
// Both variants recover from browser/Twitch visibility pauses. Twitch-only
// additionally treats PAUSE while its cross-origin iframe owns focus as an
// explicit user decision and suspends automatic recovery until Twitch emits
// PLAY/PLAYING again. The dual companion deliberately ignores manual pauses.
export default function TwitchCompanionPlayer({
  channel,
  parent,
  enforcePlayback = true,
  respectManualPause = false,
  className = "stream-twitch-companion",
  ariaLabel = "Directo de Twitch silenciado",
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const resumeRef = useRef(() => {});
  const cancelResumeRef = useRef(() => {});
  const manualPauseRef = useRef(false);

  useEffect(() => {
    let retryTimeoutIds = [];

    function tryResumeOnce() {
      try {
        playerRef.current?.setMuted?.(true);
        playerRef.current?.play?.()?.catch?.(() => {});
      } catch {}
    }

    function resume() {
      if (!enforcePlayback) return;
      if (respectManualPause && manualPauseRef.current) return;
      retryTimeoutIds.forEach((id) => window.clearTimeout(id));
      retryTimeoutIds = RESUME_RETRY_DELAYS_MS.map((delay) => (
        window.setTimeout(tryResumeOnce, delay)
      ));
    }

    function cancelResume() {
      retryTimeoutIds.forEach((id) => window.clearTimeout(id));
      retryTimeoutIds = [];
    }

    resumeRef.current = resume;
    cancelResumeRef.current = cancelResume;

    return () => {
      cancelResume();
      resumeRef.current = () => {};
      cancelResumeRef.current = () => {};
    };
  }, [enforcePlayback, respectManualPause]);

  useEffect(() => {
    if (!channel || !parent) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    // Twitch requires an element id, but rendering a generated id during SSR
    // makes it depend on React's hydration tree. Assign it only after mount so
    // browser identity/viewport changes cannot produce an SSR/client mismatch.
    if (!container.id) {
      const clientId = window.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      container.id = `twitch-companion-player-${clientId}`;
    }
    const containerId = container.id;
    let isCancelled = false;

    loadTwitchEmbedScript()
      .then(() => {
        if (isCancelled || !window.Twitch?.Player) return;

        const player = new window.Twitch.Player(containerId, {
          channel,
          parent: [parent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });

        playerRef.current = player;
        player.addEventListener(window.Twitch.Player.READY, () => {
          notifyPlaybackState("ready");
          if (enforcePlayback) resumeRef.current();
        });
        player.addEventListener(window.Twitch.Player.ONLINE, () => {
          notifyPlaybackState("online");
          if (enforcePlayback) resumeRef.current();
        });
        if (window.Twitch.Player.PLAY) {
          player.addEventListener(window.Twitch.Player.PLAY, () => {
            manualPauseRef.current = false;
            notifyPlaybackState("playing");
          });
        }
        if (window.Twitch.Player.PLAYING) {
          player.addEventListener(window.Twitch.Player.PLAYING, () => {
            manualPauseRef.current = false;
            notifyPlaybackState("playing");
          });
        }
        if (window.Twitch.Player.PAUSE) {
          player.addEventListener(window.Twitch.Player.PAUSE, () => {
            const iframe = containerRef.current?.querySelector("iframe");
            const isManualPause = Boolean(
              respectManualPause
              && iframe
              && document.activeElement === iframe
              && !document.hidden
            );
            if (isManualPause) {
              manualPauseRef.current = true;
              cancelResumeRef.current();
            }
            notifyPlaybackState("paused");
            if (enforcePlayback && !isManualPause) resumeRef.current();
          });
        }
        if (window.Twitch.Player.PLAYBACK_BLOCKED) {
          player.addEventListener(window.Twitch.Player.PLAYBACK_BLOCKED, () => notifyPlaybackState("blocked"));
        }
        if (window.Twitch.Player.OFFLINE) {
          player.addEventListener(window.Twitch.Player.OFFLINE, () => notifyPlaybackState("offline"));
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      if (typeof playerRef.current?.destroy === "function") playerRef.current.destroy();
      playerRef.current = null;
    };
  }, [channel, enforcePlayback, parent, respectManualPause]);

  useEffect(() => {
    if (!enforcePlayback) return undefined;

    function resume() {
      resumeRef.current();
    }

    function handlePlayRequest(event) {
      if (event.detail?.refreshChannel) {
        manualPauseRef.current = false;
        cancelResumeRef.current();
        try {
          playerRef.current?.setChannel?.(channel);
        } catch {}
      }
      resume();
    }

    function handleFullscreenChange() {
      if (!document.fullscreenElement) resume();
    }

    function handleVisibilityChange() {
      if (!document.hidden) resume();
    }

    window.addEventListener("kala:twitch-play-request", handlePlayRequest);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", resume);

    const playbackMonitor = window.setInterval(() => {
      if (document.hidden || (respectManualPause && manualPauseRef.current)) return;
      try {
        if (playerRef.current?.isPaused?.() === true) resumeRef.current();
      } catch {}
    }, 2500);

    return () => {
      window.removeEventListener("kala:twitch-play-request", handlePlayRequest);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", resume);
      window.clearInterval(playbackMonitor);
    };
  }, [channel, enforcePlayback, respectManualPause]);

  return (
    <div
      className={`stream-frame ${className}`}
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="twitch-player-embed" />
    </div>
  );
}
