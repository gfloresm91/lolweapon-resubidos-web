"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import OkruWatchPlayer from "@/components/OkruWatchPlayer";

// Mismo selector que ya usa PieroVideoPlayer.js internamente para encontrar el <video> real dentro
// del media provider de Vidstack (no hay shadow DOM de por medio, confirmado por su propio código).
// OK.RU es un <iframe> de un tercero - nunca va a matchear este selector, así que si lo encontramos
// sabemos que la fuente activa es Piero sin necesidad de leer estado de OkruWatchPlayer (no se toca
// ese componente, así que no hay otra forma de saber qué parte está activa desde afuera).
const VIDEO_SELECTOR = "[data-media-provider] video";

function postToNative(message) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

export default function MobileEmbedPlayer({ okruLinks, pieroLinks, liveId, title }) {
  const searchParams = useSearchParams();
  const resumeSeconds = Number(searchParams.get("resume"));
  const seekedRef = useRef(false);

  useEffect(() => {
    seekedRef.current = false;
    let currentVideo = null;
    let detach = null;

    function resolvePartIndex(video) {
      const src = video.currentSrc || video.src || "";
      const index = pieroLinks.findIndex((href) => src.includes(href) || href.includes(src));
      return index >= 0 ? index : 0;
    }

    function attach(video) {
      currentVideo = video;
      const partIndex = resolvePartIndex(video);

      const emit = (type) => () =>
        postToNative({
          type,
          source: "piero",
          partIndex,
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : null,
        });

      const onTimeUpdate = emit("timeupdate");
      const onPause = emit("pause");
      const onEnded = emit("ended");

      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);

      if (!seekedRef.current && Number.isFinite(resumeSeconds) && resumeSeconds > 0) {
        seekedRef.current = true;
        const seek = () => {
          video.currentTime = resumeSeconds;
        };
        if (video.readyState >= 1) seek();
        else video.addEventListener("loadedmetadata", seek, { once: true });
      }

      return () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
      };
    }

    // Cambiar de parte reemplaza el <video> (PieroVideoPlayer lo remonta con un key nuevo por
    // link), así que un MutationObserver detecta el reemplazo sin necesitar hooks de React.
    const tryFind = () => {
      const el = document.querySelector(VIDEO_SELECTOR);
      if (el && el !== currentVideo) {
        if (detach) detach();
        detach = attach(el);
      }
    };

    tryFind();
    const observer = new MutationObserver(tryFind);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (detach) detach();
    };
  }, [pieroLinks, resumeSeconds]);

  return (
    <>
      {/* Esta página solo la carga el WebView de la app (nadie la linkea desde el sitio), así que
          es seguro ocultar acá el chrome que apps/internal reconstruye nativo (título, modo
          teatro, tabs de fuente, selector de partes, acciones abrir/descargar/compartir) sin tocar
          OkruWatchPlayer.js - queda visible solo watch-player-wrap/watch-player-placeholder (el
          video/iframe real). Como el botón que activa modo teatro queda oculto, ese estado nunca
          se puede alcanzar. */}
      <style>{`
        .watch-mini-header,
        .watch-theater-exit,
        .watch-player-topline,
        .watch-link-group {
          display: none !important;
        }
      `}</style>
      <OkruWatchPlayer okruLinks={okruLinks} pieroLinks={pieroLinks} liveId={String(liveId)} title={title} />
    </>
  );
}
